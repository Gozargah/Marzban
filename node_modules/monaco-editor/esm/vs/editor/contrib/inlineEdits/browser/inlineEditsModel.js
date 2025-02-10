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
var InlineEditsModel_1;
import { timeout } from '../../../../base/common/async.js';
import { CancellationToken, cancelOnDispose } from '../../../../base/common/cancellation.js';
import { itemsEquals, structuralEquals } from '../../../../base/common/equals.js';
import { BugIndicatingError } from '../../../../base/common/errors.js';
import { Disposable, DisposableStore, toDisposable } from '../../../../base/common/lifecycle.js';
import { ObservablePromise, derived, derivedHandleChanges, derivedOpts, disposableObservableValue, observableSignal, observableValue, recomputeInitiallyAndOnChange, subtransaction } from '../../../../base/common/observable.js';
import { derivedDisposable } from '../../../../base/common/observableInternal/derived.js';
import { URI } from '../../../../base/common/uri.js';
import { IDiffProviderFactoryService } from '../../../browser/widget/diffEditor/diffProviderFactoryService.js';
import { LineRange } from '../../../common/core/lineRange.js';
import { InlineCompletionTriggerKind } from '../../../common/languages.js';
import { ILanguageFeaturesService } from '../../../common/services/languageFeatures.js';
import { IModelService } from '../../../common/services/model.js';
import { provideInlineCompletions } from '../../inlineCompletions/browser/model/provideInlineCompletions.js';
import { InlineEdit } from './inlineEditsWidget.js';
let InlineEditsModel = class InlineEditsModel extends Disposable {
    static { InlineEditsModel_1 = this; }
    static { this._modelId = 0; }
    static _createUniqueUri() {
        return URI.from({ scheme: 'inline-edits', path: new Date().toString() + String(InlineEditsModel_1._modelId++) });
    }
    constructor(textModel, _textModelVersionId, _selection, _debounceValue, languageFeaturesService, _diffProviderFactoryService, _modelService) {
        super();
        this.textModel = textModel;
        this._textModelVersionId = _textModelVersionId;
        this._selection = _selection;
        this._debounceValue = _debounceValue;
        this.languageFeaturesService = languageFeaturesService;
        this._diffProviderFactoryService = _diffProviderFactoryService;
        this._modelService = _modelService;
        this._forceUpdateExplicitlySignal = observableSignal(this);
        // We use a semantic id to keep the same inline completion selected even if the provider reorders the completions.
        this._selectedInlineCompletionId = observableValue(this, undefined);
        this._isActive = observableValue(this, false);
        this._originalModel = derivedDisposable(() => this._modelService.createModel('', null, InlineEditsModel_1._createUniqueUri())).keepObserved(this._store);
        this._modifiedModel = derivedDisposable(() => this._modelService.createModel('', null, InlineEditsModel_1._createUniqueUri())).keepObserved(this._store);
        this._pinnedRange = new TrackedRange(this.textModel, this._textModelVersionId);
        this.isPinned = this._pinnedRange.range.map(range => !!range);
        this.userPrompt = observableValue(this, undefined);
        this.inlineEdit = derived(this, reader => {
            return this._inlineEdit.read(reader)?.promiseResult.read(reader)?.data;
        });
        this._inlineEdit = derived(this, reader => {
            const edit = this.selectedInlineEdit.read(reader);
            if (!edit) {
                return undefined;
            }
            const range = edit.inlineCompletion.range;
            if (edit.inlineCompletion.insertText.trim() === '') {
                return undefined;
            }
            let newLines = edit.inlineCompletion.insertText.split(/\r\n|\r|\n/);
            function removeIndentation(lines) {
                const indentation = lines[0].match(/^\s*/)?.[0] ?? '';
                return lines.map(l => l.replace(new RegExp('^' + indentation), ''));
            }
            newLines = removeIndentation(newLines);
            const existing = this.textModel.getValueInRange(range);
            let existingLines = existing.split(/\r\n|\r|\n/);
            existingLines = removeIndentation(existingLines);
            this._originalModel.get().setValue(existingLines.join('\n'));
            this._modifiedModel.get().setValue(newLines.join('\n'));
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
                return new InlineEdit(LineRange.fromRangeInclusive(range), removeIndentation(newLines), result.changes);
            });
        });
        this._fetchStore = this._register(new DisposableStore());
        this._inlineEditsFetchResult = disposableObservableValue(this, undefined);
        this._inlineEdits = derivedOpts({ owner: this, equalsFn: structuralEquals }, reader => {
            return this._inlineEditsFetchResult.read(reader)?.completions.map(c => new InlineEditData(c)) ?? [];
        });
        this._fetchInlineEditsPromise = derivedHandleChanges({
            owner: this,
            createEmptyChangeSummary: () => ({
                inlineCompletionTriggerKind: InlineCompletionTriggerKind.Automatic
            }),
            handleChange: (ctx, changeSummary) => {
                /** @description fetch inline completions */
                if (ctx.didChange(this._forceUpdateExplicitlySignal)) {
                    changeSummary.inlineCompletionTriggerKind = InlineCompletionTriggerKind.Explicit;
                }
                return true;
            },
        }, async (reader, changeSummary) => {
            this._fetchStore.clear();
            this._forceUpdateExplicitlySignal.read(reader);
            /*if (!this._isActive.read(reader)) {
                return undefined;
            }*/
            this._textModelVersionId.read(reader);
            function mapValue(value, fn) {
                return fn(value);
            }
            const selection = this._pinnedRange.range.read(reader) ?? mapValue(this._selection.read(reader), v => v.isEmpty() ? undefined : v);
            if (!selection) {
                this._inlineEditsFetchResult.set(undefined, undefined);
                this.userPrompt.set(undefined, undefined);
                return undefined;
            }
            const context = {
                triggerKind: changeSummary.inlineCompletionTriggerKind,
                selectedSuggestionInfo: undefined,
                userPrompt: this.userPrompt.read(reader),
            };
            const token = cancelOnDispose(this._fetchStore);
            await timeout(200, token);
            const result = await provideInlineCompletions(this.languageFeaturesService.inlineCompletionsProvider, selection, this.textModel, context, token);
            if (token.isCancellationRequested) {
                return;
            }
            this._inlineEditsFetchResult.set(result, undefined);
        });
        this._filteredInlineEditItems = derivedOpts({ owner: this, equalsFn: itemsEquals() }, reader => {
            return this._inlineEdits.read(reader);
        });
        this.selectedInlineCompletionIndex = derived(this, (reader) => {
            const selectedInlineCompletionId = this._selectedInlineCompletionId.read(reader);
            const filteredCompletions = this._filteredInlineEditItems.read(reader);
            const idx = this._selectedInlineCompletionId === undefined ? -1
                : filteredCompletions.findIndex(v => v.semanticId === selectedInlineCompletionId);
            if (idx === -1) {
                // Reset the selection so that the selection does not jump back when it appears again
                this._selectedInlineCompletionId.set(undefined, undefined);
                return 0;
            }
            return idx;
        });
        this.selectedInlineEdit = derived(this, (reader) => {
            const filteredCompletions = this._filteredInlineEditItems.read(reader);
            const idx = this.selectedInlineCompletionIndex.read(reader);
            return filteredCompletions[idx];
        });
        this._register(recomputeInitiallyAndOnChange(this._fetchInlineEditsPromise));
    }
    async triggerExplicitly(tx) {
        subtransaction(tx, tx => {
            this._isActive.set(true, tx);
            this._forceUpdateExplicitlySignal.trigger(tx);
        });
        await this._fetchInlineEditsPromise.get();
    }
    stop(tx) {
        subtransaction(tx, tx => {
            this.userPrompt.set(undefined, tx);
            this._isActive.set(false, tx);
            this._inlineEditsFetchResult.set(undefined, tx);
            this._pinnedRange.setRange(undefined, tx);
            //this._source.clear(tx);
        });
    }
    async _deltaSelectedInlineCompletionIndex(delta) {
        await this.triggerExplicitly();
        const completions = this._filteredInlineEditItems.get() || [];
        if (completions.length > 0) {
            const newIdx = (this.selectedInlineCompletionIndex.get() + delta + completions.length) % completions.length;
            this._selectedInlineCompletionId.set(completions[newIdx].semanticId, undefined);
        }
        else {
            this._selectedInlineCompletionId.set(undefined, undefined);
        }
    }
    async next() {
        await this._deltaSelectedInlineCompletionIndex(1);
    }
    async previous() {
        await this._deltaSelectedInlineCompletionIndex(-1);
    }
    async accept(editor) {
        if (editor.getModel() !== this.textModel) {
            throw new BugIndicatingError();
        }
        const edit = this.selectedInlineEdit.get();
        if (!edit) {
            return;
        }
        editor.pushUndoStop();
        editor.executeEdits('inlineSuggestion.accept', [
            edit.inlineCompletion.toSingleTextEdit().toSingleEditOperation()
        ]);
        this.stop();
    }
};
InlineEditsModel = InlineEditsModel_1 = __decorate([
    __param(4, ILanguageFeaturesService),
    __param(5, IDiffProviderFactoryService),
    __param(6, IModelService)
], InlineEditsModel);
export { InlineEditsModel };
class InlineEditData {
    constructor(inlineCompletion) {
        this.inlineCompletion = inlineCompletion;
        this.semanticId = this.inlineCompletion.hash();
    }
}
class TrackedRange extends Disposable {
    constructor(_textModel, _versionId) {
        super();
        this._textModel = _textModel;
        this._versionId = _versionId;
        this._decorations = observableValue(this, []);
        this.range = derived(this, reader => {
            this._versionId.read(reader);
            const deco = this._decorations.read(reader)[0];
            if (!deco) {
                return null;
            }
            return this._textModel.getDecorationRange(deco) ?? null;
        });
        this._register(toDisposable(() => {
            this._textModel.deltaDecorations(this._decorations.get(), []);
        }));
    }
    setRange(range, tx) {
        this._decorations.set(this._textModel.deltaDecorations(this._decorations.get(), range ? [{ range, options: { description: 'trackedRange' } }] : []), tx);
    }
}
