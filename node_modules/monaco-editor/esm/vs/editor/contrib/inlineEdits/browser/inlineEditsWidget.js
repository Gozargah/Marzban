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
import { h, svgElem } from '../../../../base/browser/dom.js';
import { DEFAULT_FONT_FAMILY } from '../../../../base/browser/fonts.js';
import { Disposable, DisposableStore } from '../../../../base/common/lifecycle.js';
import { autorun, constObservable, derived } from '../../../../base/common/observable.js';
import { derivedWithSetter } from '../../../../base/common/observableInternal/derived.js';
import './inlineEditsWidget.css';
import { EditorExtensionsRegistry } from '../../../browser/editorExtensions.js';
import { observableCodeEditor } from '../../../browser/observableCodeEditor.js';
import { EmbeddedCodeEditorWidget } from '../../../browser/widget/codeEditor/embeddedCodeEditorWidget.js';
import { diffAddDecoration, diffAddDecorationEmpty, diffDeleteDecoration, diffDeleteDecorationEmpty, diffLineAddDecorationBackgroundWithIndicator, diffLineDeleteDecorationBackgroundWithIndicator, diffWholeLineAddDecoration, diffWholeLineDeleteDecoration } from '../../../browser/widget/diffEditor/registrations.contribution.js';
import { appendRemoveOnDispose, applyStyle } from '../../../browser/widget/diffEditor/utils.js';
import { PLAINTEXT_LANGUAGE_ID } from '../../../common/languages/modesRegistry.js';
import { TextModel } from '../../../common/model/textModel.js';
import { ContextMenuController } from '../../contextmenu/browser/contextmenu.js';
import { PlaceholderTextContribution } from '../../placeholderText/browser/placeholderTextContribution.js';
import { SuggestController } from '../../suggest/browser/suggestController.js';
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
export class InlineEdit {
    constructor(range, newLines, changes) {
        this.range = range;
        this.newLines = newLines;
        this.changes = changes;
    }
}
let InlineEditsWidget = class InlineEditsWidget extends Disposable {
    constructor(_editor, _edit, _userPrompt, _instantiationService) {
        super();
        this._editor = _editor;
        this._edit = _edit;
        this._userPrompt = _userPrompt;
        this._instantiationService = _instantiationService;
        this._editorObs = observableCodeEditor(this._editor);
        this._elements = h('div.inline-edits-widget', {
            style: {
                position: 'absolute',
                overflow: 'visible',
                top: '0px',
                left: '0px',
            },
        }, [
            h('div@editorContainer', { style: { position: 'absolute', top: '0px', left: '0px', width: '500px', height: '500px', } }, [
                h('div.toolbar@toolbar', { style: { position: 'absolute', top: '-25px', left: '0px' } }),
                h('div.promptEditor@promptEditor', { style: { position: 'absolute', top: '-25px', left: '80px', width: '300px', height: '22px' } }),
                h('div.preview@editor', { style: { position: 'absolute', top: '0px', left: '0px' } }),
            ]),
            svgElem('svg', { style: { overflow: 'visible', pointerEvents: 'none' }, }, [
                svgElem('defs', [
                    svgElem('linearGradient', {
                        id: 'Gradient2',
                        x1: '0',
                        y1: '0',
                        x2: '1',
                        y2: '0',
                    }, [
                        /*svgElem('stop', { offset: '0%', class: 'gradient-start', }),
                        svgElem('stop', { offset: '0%', class: 'gradient-start', }),
                        svgElem('stop', { offset: '20%', class: 'gradient-stop', }),*/
                        svgElem('stop', { offset: '0%', class: 'gradient-stop', }),
                        svgElem('stop', { offset: '100%', class: 'gradient-stop', }),
                    ]),
                ]),
                svgElem('path@path', {
                    d: '',
                    fill: 'url(#Gradient2)',
                }),
            ]),
        ]);
        this._previewTextModel = this._register(this._instantiationService.createInstance(TextModel, '', PLAINTEXT_LANGUAGE_ID, TextModel.DEFAULT_CREATION_OPTIONS, null));
        this._setText = derived(reader => {
            const edit = this._edit.read(reader);
            if (!edit) {
                return;
            }
            this._previewTextModel.setValue(edit.newLines.join('\n'));
        }).recomputeInitiallyAndOnChange(this._store);
        this._promptTextModel = this._register(this._instantiationService.createInstance(TextModel, '', PLAINTEXT_LANGUAGE_ID, TextModel.DEFAULT_CREATION_OPTIONS, null));
        this._promptEditor = this._register(this._instantiationService.createInstance(EmbeddedCodeEditorWidget, this._elements.promptEditor, {
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
            placeholder: 'Describe the change you want...',
            fontFamily: DEFAULT_FONT_FAMILY,
        }, {
            contributions: EditorExtensionsRegistry.getSomeEditorContributions([
                SuggestController.ID,
                PlaceholderTextContribution.ID,
                ContextMenuController.ID,
            ]),
            isSimpleWidget: true
        }, this._editor));
        this._previewEditor = this._register(this._instantiationService.createInstance(EmbeddedCodeEditorWidget, this._elements.editor, {
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
        }, { contributions: [], }, this._editor));
        this._previewEditorObs = observableCodeEditor(this._previewEditor);
        this._decorations = derived(this, (reader) => {
            this._setText.read(reader);
            const diff = this._edit.read(reader)?.changes;
            if (!diff) {
                return [];
            }
            const originalDecorations = [];
            const modifiedDecorations = [];
            if (diff.length === 1 && diff[0].innerChanges[0].modifiedRange.equalsRange(this._previewTextModel.getFullModelRange())) {
                return [];
            }
            for (const m of diff) {
                if (!m.original.isEmpty) {
                    originalDecorations.push({ range: m.original.toInclusiveRange(), options: diffLineDeleteDecorationBackgroundWithIndicator });
                }
                if (!m.modified.isEmpty) {
                    modifiedDecorations.push({ range: m.modified.toInclusiveRange(), options: diffLineAddDecorationBackgroundWithIndicator });
                }
                if (m.modified.isEmpty || m.original.isEmpty) {
                    if (!m.original.isEmpty) {
                        originalDecorations.push({ range: m.original.toInclusiveRange(), options: diffWholeLineDeleteDecoration });
                    }
                    if (!m.modified.isEmpty) {
                        modifiedDecorations.push({ range: m.modified.toInclusiveRange(), options: diffWholeLineAddDecoration });
                    }
                }
                else {
                    for (const i of m.innerChanges || []) {
                        // Don't show empty markers outside the line range
                        if (m.original.contains(i.originalRange.startLineNumber)) {
                            originalDecorations.push({ range: i.originalRange, options: i.originalRange.isEmpty() ? diffDeleteDecorationEmpty : diffDeleteDecoration });
                        }
                        if (m.modified.contains(i.modifiedRange.startLineNumber)) {
                            modifiedDecorations.push({ range: i.modifiedRange, options: i.modifiedRange.isEmpty() ? diffAddDecorationEmpty : diffAddDecoration });
                        }
                    }
                }
            }
            return modifiedDecorations;
        });
        this._layout1 = derived(this, reader => {
            const model = this._editor.getModel();
            const inlineEdit = this._edit.read(reader);
            if (!inlineEdit) {
                return null;
            }
            const range = inlineEdit.range;
            let maxLeft = 0;
            for (let i = range.startLineNumber; i < range.endLineNumberExclusive; i++) {
                const column = model.getLineMaxColumn(i);
                const left = this._editor.getOffsetForColumn(i, column);
                maxLeft = Math.max(maxLeft, left);
            }
            const layoutInfo = this._editor.getLayoutInfo();
            const contentLeft = layoutInfo.contentLeft;
            return { left: contentLeft + maxLeft };
        });
        this._layout = derived(this, (reader) => {
            const inlineEdit = this._edit.read(reader);
            if (!inlineEdit) {
                return null;
            }
            const range = inlineEdit.range;
            const scrollLeft = this._editorObs.scrollLeft.read(reader);
            const left = this._layout1.read(reader).left + 20 - scrollLeft;
            const selectionTop = this._editor.getTopForLineNumber(range.startLineNumber) - this._editorObs.scrollTop.read(reader);
            const selectionBottom = this._editor.getTopForLineNumber(range.endLineNumberExclusive) - this._editorObs.scrollTop.read(reader);
            const topCode = new Point(left, selectionTop);
            const bottomCode = new Point(left, selectionBottom);
            const codeHeight = selectionBottom - selectionTop;
            const codeEditDist = 50;
            const editHeight = this._editor.getOption(67 /* EditorOption.lineHeight */) * inlineEdit.newLines.length;
            const difference = codeHeight - editHeight;
            const topEdit = new Point(left + codeEditDist, selectionTop + (difference / 2));
            const bottomEdit = new Point(left + codeEditDist, selectionBottom - (difference / 2));
            return {
                topCode,
                bottomCode,
                codeHeight,
                topEdit,
                bottomEdit,
                editHeight,
            };
        });
        const visible = derived(this, reader => this._edit.read(reader) !== undefined || this._userPrompt.read(reader) !== undefined);
        this._register(applyStyle(this._elements.root, {
            display: derived(this, reader => visible.read(reader) ? 'block' : 'none')
        }));
        this._register(appendRemoveOnDispose(this._editor.getDomNode(), this._elements.root));
        this._register(observableCodeEditor(_editor).createOverlayWidget({
            domNode: this._elements.root,
            position: constObservable(null),
            allowEditorOverflow: false,
            minContentWidthInPx: derived(reader => {
                const x = this._layout1.read(reader)?.left;
                if (x === undefined) {
                    return 0;
                }
                const width = this._previewEditorObs.contentWidth.read(reader);
                return x + width;
            }),
        }));
        this._previewEditor.setModel(this._previewTextModel);
        this._register(this._previewEditorObs.setDecorations(this._decorations));
        this._register(autorun(reader => {
            const layoutInfo = this._layout.read(reader);
            if (!layoutInfo) {
                return;
            }
            const { topCode, bottomCode, topEdit, bottomEdit, editHeight } = layoutInfo;
            const straightWidthCode = 10;
            const straightWidthEdit = 0;
            const bezierDist = 40;
            const path = new PathBuilder()
                .moveTo(topCode)
                .lineTo(topCode.deltaX(straightWidthCode))
                .curveTo(topCode.deltaX(straightWidthCode + bezierDist), topEdit.deltaX(-bezierDist - straightWidthEdit), topEdit.deltaX(-straightWidthEdit))
                .lineTo(topEdit)
                .lineTo(bottomEdit)
                .lineTo(bottomEdit.deltaX(-straightWidthEdit))
                .curveTo(bottomEdit.deltaX(-bezierDist - straightWidthEdit), bottomCode.deltaX(straightWidthCode + bezierDist), bottomCode.deltaX(straightWidthCode))
                .lineTo(bottomCode)
                .build();
            this._elements.path.setAttribute('d', path);
            this._elements.editorContainer.style.top = `${topEdit.y}px`;
            this._elements.editorContainer.style.left = `${topEdit.x}px`;
            this._elements.editorContainer.style.height = `${editHeight}px`;
            const width = this._previewEditorObs.contentWidth.read(reader);
            this._previewEditor.layout({ height: editHeight, width });
        }));
        this._promptEditor.setModel(this._promptTextModel);
        this._promptEditor.layout();
        this._register(createTwoWaySync(mapSettableObservable(this._userPrompt, v => v ?? '', v => v), observableCodeEditor(this._promptEditor).value));
        this._register(autorun(reader => {
            const isFocused = observableCodeEditor(this._promptEditor).isFocused.read(reader);
            this._elements.root.classList.toggle('focused', isFocused);
        }));
    }
};
InlineEditsWidget = __decorate([
    __param(3, IInstantiationService)
], InlineEditsWidget);
export { InlineEditsWidget };
function mapSettableObservable(obs, fn1, fn2) {
    return derivedWithSetter(undefined, reader => fn1(obs.read(reader)), (value, tx) => obs.set(fn2(value), tx));
}
class Point {
    constructor(x, y) {
        this.x = x;
        this.y = y;
    }
    deltaX(delta) {
        return new Point(this.x + delta, this.y);
    }
}
class PathBuilder {
    constructor() {
        this._data = '';
    }
    moveTo(point) {
        this._data += `M ${point.x} ${point.y} `;
        return this;
    }
    lineTo(point) {
        this._data += `L ${point.x} ${point.y} `;
        return this;
    }
    curveTo(cp1, cp2, to) {
        this._data += `C ${cp1.x} ${cp1.y} ${cp2.x} ${cp2.y} ${to.x} ${to.y} `;
        return this;
    }
    build() {
        return this._data;
    }
}
function createTwoWaySync(main, target) {
    const store = new DisposableStore();
    store.add(autorun(reader => {
        const value = main.read(reader);
        target.set(value, undefined);
    }));
    store.add(autorun(reader => {
        const value = target.read(reader);
        main.set(value, undefined);
    }));
    return store;
}
