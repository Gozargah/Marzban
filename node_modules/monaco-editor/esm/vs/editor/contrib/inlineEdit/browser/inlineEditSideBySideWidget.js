/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var InlineEditSideBySideWidget_1, InlineEditSideBySideContentWidget_1;
import { $ } from '../../../../base/browser/dom.js';
import { CancellationToken } from '../../../../base/common/cancellation.js';
import { Disposable, toDisposable } from '../../../../base/common/lifecycle.js';
import { ObservablePromise, autorun, autorunWithStore, derived, observableSignalFromEvent } from '../../../../base/common/observable.js';
import { derivedDisposable } from '../../../../base/common/observableInternal/derived.js';
import { URI } from '../../../../base/common/uri.js';
import './inlineEditSideBySideWidget.css';
import { observableCodeEditor } from '../../../browser/observableCodeEditor.js';
import { EmbeddedCodeEditorWidget } from '../../../browser/widget/codeEditor/embeddedCodeEditorWidget.js';
import { IDiffProviderFactoryService } from '../../../browser/widget/diffEditor/diffProviderFactoryService.js';
import { diffAddDecoration, diffAddDecorationEmpty, diffDeleteDecoration, diffDeleteDecorationEmpty, diffLineAddDecorationBackgroundWithIndicator, diffLineDeleteDecorationBackgroundWithIndicator, diffWholeLineAddDecoration, diffWholeLineDeleteDecoration } from '../../../browser/widget/diffEditor/registrations.contribution.js';
import { Position } from '../../../common/core/position.js';
import { Range } from '../../../common/core/range.js';
import { PLAINTEXT_LANGUAGE_ID } from '../../../common/languages/modesRegistry.js';
import { TextModel } from '../../../common/model/textModel.js';
import { IModelService } from '../../../common/services/model.js';
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
function* range(start, end, step = 1) {
    if (end === undefined) {
        [end, start] = [start, 0];
    }
    for (let n = start; n < end; n += step) {
        yield n;
    }
}
function removeIndentation(lines) {
    const indentation = lines[0].match(/^\s*/)?.[0] ?? '';
    const length = indentation.length;
    return {
        text: lines.map(l => l.replace(new RegExp('^' + indentation), '')),
        shift: length
    };
}
let InlineEditSideBySideWidget = class InlineEditSideBySideWidget extends Disposable {
    static { InlineEditSideBySideWidget_1 = this; }
    static { this._modelId = 0; }
    static _createUniqueUri() {
        return URI.from({ scheme: 'inline-edit-widget', path: new Date().toString() + String(InlineEditSideBySideWidget_1._modelId++) });
    }
    constructor(_editor, _model, _instantiationService, _diffProviderFactoryService, _modelService) {
        super();
        this._editor = _editor;
        this._model = _model;
        this._instantiationService = _instantiationService;
        this._diffProviderFactoryService = _diffProviderFactoryService;
        this._modelService = _modelService;
        this._position = derived(this, reader => {
            const ghostText = this._model.read(reader);
            if (!ghostText || ghostText.text.length === 0) {
                return null;
            }
            if (ghostText.range.startLineNumber === ghostText.range.endLineNumber && !(ghostText.range.startColumn === ghostText.range.endColumn && ghostText.range.startColumn === 1)) {
                //for inner-line suggestions we still want to use minimal ghost text
                return null;
            }
            const editorModel = this._editor.getModel();
            if (!editorModel) {
                return null;
            }
            const lines = Array.from(range(ghostText.range.startLineNumber, ghostText.range.endLineNumber + 1));
            const lengths = lines.map(lineNumber => editorModel.getLineLastNonWhitespaceColumn(lineNumber));
            const maxColumn = Math.max(...lengths);
            const lineOfMaxColumn = lines[lengths.indexOf(maxColumn)];
            const position = new Position(lineOfMaxColumn, maxColumn);
            const pos = {
                top: ghostText.range.startLineNumber,
                left: position
            };
            return pos;
        });
        this._text = derived(this, reader => {
            const ghostText = this._model.read(reader);
            if (!ghostText) {
                return { text: '', shift: 0 };
            }
            const t = removeIndentation(ghostText.text.split('\n'));
            return {
                text: t.text.join('\n'),
                shift: t.shift
            };
        });
        this._originalModel = derivedDisposable(() => this._modelService.createModel('', null, InlineEditSideBySideWidget_1._createUniqueUri())).keepObserved(this._store);
        this._modifiedModel = derivedDisposable(() => this._modelService.createModel('', null, InlineEditSideBySideWidget_1._createUniqueUri())).keepObserved(this._store);
        this._diff = derived(this, reader => {
            return this._diffPromise.read(reader)?.promiseResult.read(reader)?.data;
        });
        this._diffPromise = derived(this, reader => {
            const ghostText = this._model.read(reader);
            if (!ghostText) {
                return;
            }
            const editorModel = this._editor.getModel();
            if (!editorModel) {
                return;
            }
            const originalText = removeIndentation(editorModel.getValueInRange(ghostText.range).split('\n')).text.join('\n');
            const modifiedText = removeIndentation(ghostText.text.split('\n')).text.join('\n');
            this._originalModel.get().setValue(originalText);
            this._modifiedModel.get().setValue(modifiedText);
            const d = this._diffProviderFactoryService.createDiffProvider({ diffAlgorithm: 'advanced' });
            return ObservablePromise.fromFn(async () => {
                const result = await d.computeDiff(this._originalModel.get(), this._modifiedModel.get(), {
                    computeMoves: false,
                    ignoreTrimWhitespace: false,
                    maxComputationTimeMs: 1000,
                }, CancellationToken.None);
                if (result.identical) {
                    return undefined;
                }
                return result.changes;
            });
        });
        this._register(autorunWithStore((reader, store) => {
            /** @description setup content widget */
            const model = this._model.read(reader);
            if (!model) {
                return;
            }
            if (this._position.get() === null) {
                return;
            }
            const contentWidget = store.add(this._instantiationService.createInstance(InlineEditSideBySideContentWidget, this._editor, this._position, this._text.map(t => t.text), this._text.map(t => t.shift), this._diff));
            _editor.addOverlayWidget(contentWidget);
            store.add(toDisposable(() => _editor.removeOverlayWidget(contentWidget)));
        }));
    }
};
InlineEditSideBySideWidget = InlineEditSideBySideWidget_1 = __decorate([
    __param(2, IInstantiationService),
    __param(3, IDiffProviderFactoryService),
    __param(4, IModelService)
], InlineEditSideBySideWidget);
export { InlineEditSideBySideWidget };
let InlineEditSideBySideContentWidget = class InlineEditSideBySideContentWidget extends Disposable {
    static { InlineEditSideBySideContentWidget_1 = this; }
    static { this.id = 0; }
    constructor(_editor, _position, _text, _shift, _diff, _instantiationService) {
        super();
        this._editor = _editor;
        this._position = _position;
        this._text = _text;
        this._shift = _shift;
        this._diff = _diff;
        this._instantiationService = _instantiationService;
        this.id = `InlineEditSideBySideContentWidget${InlineEditSideBySideContentWidget_1.id++}`;
        this.allowEditorOverflow = false;
        this._nodes = $('div.inlineEditSideBySide', undefined);
        this._scrollChanged = observableSignalFromEvent('editor.onDidScrollChange', this._editor.onDidScrollChange);
        this._previewEditor = this._register(this._instantiationService.createInstance(EmbeddedCodeEditorWidget, this._nodes, {
            glyphMargin: false,
            lineNumbers: 'off',
            minimap: { enabled: false },
            guides: {
                indentation: false,
                bracketPairs: false,
                bracketPairsHorizontal: false,
                highlightActiveIndentation: false,
            },
            folding: false,
            selectOnLineNumbers: false,
            selectionHighlight: false,
            columnSelection: false,
            overviewRulerBorder: false,
            overviewRulerLanes: 0,
            lineDecorationsWidth: 0,
            lineNumbersMinChars: 0,
            scrollbar: { vertical: 'hidden', horizontal: 'hidden', alwaysConsumeMouseWheel: false, handleMouseWheel: false },
            readOnly: true,
            wordWrap: 'off',
            wordWrapOverride1: 'off',
            wordWrapOverride2: 'off',
            wrappingIndent: 'none',
            wrappingStrategy: undefined,
        }, { contributions: [], isSimpleWidget: true }, this._editor));
        this._previewEditorObs = observableCodeEditor(this._previewEditor);
        this._editorObs = observableCodeEditor(this._editor);
        this._previewTextModel = this._register(this._instantiationService.createInstance(TextModel, '', this._editor.getModel()?.getLanguageId() ?? PLAINTEXT_LANGUAGE_ID, TextModel.DEFAULT_CREATION_OPTIONS, null));
        this._setText = derived(reader => {
            const edit = this._text.read(reader);
            if (!edit) {
                return;
            }
            this._previewTextModel.setValue(edit);
        }).recomputeInitiallyAndOnChange(this._store);
        this._decorations = derived(this, (reader) => {
            this._setText.read(reader);
            const position = this._position.read(reader);
            if (!position) {
                return { org: [], mod: [] };
            }
            const diff = this._diff.read(reader);
            if (!diff) {
                return { org: [], mod: [] };
            }
            const originalDecorations = [];
            const modifiedDecorations = [];
            if (diff.length === 1 && diff[0].innerChanges[0].modifiedRange.equalsRange(this._previewTextModel.getFullModelRange())) {
                return { org: [], mod: [] };
            }
            const shift = this._shift.get();
            const moveRange = (range) => {
                return new Range(range.startLineNumber + position.top - 1, range.startColumn + shift, range.endLineNumber + position.top - 1, range.endColumn + shift);
            };
            for (const m of diff) {
                if (!m.original.isEmpty) {
                    originalDecorations.push({ range: moveRange(m.original.toInclusiveRange()), options: diffLineDeleteDecorationBackgroundWithIndicator });
                }
                if (!m.modified.isEmpty) {
                    modifiedDecorations.push({ range: m.modified.toInclusiveRange(), options: diffLineAddDecorationBackgroundWithIndicator });
                }
                if (m.modified.isEmpty || m.original.isEmpty) {
                    if (!m.original.isEmpty) {
                        originalDecorations.push({ range: moveRange(m.original.toInclusiveRange()), options: diffWholeLineDeleteDecoration });
                    }
                    if (!m.modified.isEmpty) {
                        modifiedDecorations.push({ range: m.modified.toInclusiveRange(), options: diffWholeLineAddDecoration });
                    }
                }
                else {
                    for (const i of m.innerChanges || []) {
                        // Don't show empty markers outside the line range
                        if (m.original.contains(i.originalRange.startLineNumber)) {
                            originalDecorations.push({ range: moveRange(i.originalRange), options: i.originalRange.isEmpty() ? diffDeleteDecorationEmpty : diffDeleteDecoration });
                        }
                        if (m.modified.contains(i.modifiedRange.startLineNumber)) {
                            modifiedDecorations.push({ range: i.modifiedRange, options: i.modifiedRange.isEmpty() ? diffAddDecorationEmpty : diffAddDecoration });
                        }
                    }
                }
            }
            return { org: originalDecorations, mod: modifiedDecorations };
        });
        this._originalDecorations = derived(this, reader => {
            return this._decorations.read(reader).org;
        });
        this._modifiedDecorations = derived(this, reader => {
            return this._decorations.read(reader).mod;
        });
        this._previewEditor.setModel(this._previewTextModel);
        this._register(this._editorObs.setDecorations(this._originalDecorations));
        this._register(this._previewEditorObs.setDecorations(this._modifiedDecorations));
        this._register(autorun(reader => {
            const width = this._previewEditorObs.contentWidth.read(reader);
            const lines = this._text.read(reader).split('\n').length - 1;
            const height = this._editor.getOption(67 /* EditorOption.lineHeight */) * lines;
            if (width <= 0) {
                return;
            }
            this._previewEditor.layout({ height: height, width: width });
        }));
        this._register(autorun(reader => {
            /** @description update position */
            this._position.read(reader);
            this._editor.layoutOverlayWidget(this);
        }));
        this._register(autorun(reader => {
            /** @description scroll change */
            this._scrollChanged.read(reader);
            const position = this._position.read(reader);
            if (!position) {
                return;
            }
            this._editor.layoutOverlayWidget(this);
        }));
    }
    getId() { return this.id; }
    getDomNode() {
        return this._nodes;
    }
    getPosition() {
        const position = this._position.get();
        if (!position) {
            return null;
        }
        const layoutInfo = this._editor.getLayoutInfo();
        const visibPos = this._editor.getScrolledVisiblePosition(new Position(position.top, 1));
        if (!visibPos) {
            return null;
        }
        const top = visibPos.top - 1; //-1 to offset the border width
        const offset = this._editor.getOffsetForColumn(position.left.lineNumber, position.left.column);
        const left = layoutInfo.contentLeft + offset + 10;
        return {
            preference: {
                left,
                top,
            }
        };
    }
};
InlineEditSideBySideContentWidget = InlineEditSideBySideContentWidget_1 = __decorate([
    __param(5, IInstantiationService)
], InlineEditSideBySideContentWidget);
