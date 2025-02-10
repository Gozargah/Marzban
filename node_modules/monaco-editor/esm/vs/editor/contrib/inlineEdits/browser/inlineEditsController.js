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
var InlineEditsController_1;
import { Disposable } from '../../../../base/common/lifecycle.js';
import { derived, derivedObservableWithCache, observableValue } from '../../../../base/common/observable.js';
import { derivedDisposable, derivedWithSetter } from '../../../../base/common/observableInternal/derived.js';
import { observableCodeEditor } from '../../../browser/observableCodeEditor.js';
import { readHotReloadableExport } from '../../../../base/common/hotReloadHelpers.js';
import { Selection } from '../../../common/core/selection.js';
import { ILanguageFeatureDebounceService } from '../../../common/services/languageFeatureDebounce.js';
import { ILanguageFeaturesService } from '../../../common/services/languageFeatures.js';
import { inlineEditVisible, isPinnedContextKey } from './consts.js';
import { InlineEditsModel } from './inlineEditsModel.js';
import { InlineEditsWidget } from './inlineEditsWidget.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { IContextKeyService } from '../../../../platform/contextkey/common/contextkey.js';
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { bindContextKey, observableConfigValue } from '../../../../platform/observable/common/platformObservableUtils.js';
let InlineEditsController = class InlineEditsController extends Disposable {
    static { InlineEditsController_1 = this; }
    static { this.ID = 'editor.contrib.inlineEditsController'; }
    static get(editor) {
        return editor.getContribution(InlineEditsController_1.ID);
    }
    constructor(editor, _instantiationService, _contextKeyService, _debounceService, _languageFeaturesService, _configurationService) {
        super();
        this.editor = editor;
        this._instantiationService = _instantiationService;
        this._contextKeyService = _contextKeyService;
        this._debounceService = _debounceService;
        this._languageFeaturesService = _languageFeaturesService;
        this._configurationService = _configurationService;
        this._enabled = observableConfigValue('editor.inlineEdits.enabled', false, this._configurationService);
        this._editorObs = observableCodeEditor(this.editor);
        this._selection = derived(this, reader => this._editorObs.cursorSelection.read(reader) ?? new Selection(1, 1, 1, 1));
        this._debounceValue = this._debounceService.for(this._languageFeaturesService.inlineCompletionsProvider, 'InlineEditsDebounce', { min: 50, max: 50 });
        this.model = derivedDisposable(this, reader => {
            if (!this._enabled.read(reader)) {
                return undefined;
            }
            if (this._editorObs.isReadonly.read(reader)) {
                return undefined;
            }
            const textModel = this._editorObs.model.read(reader);
            if (!textModel) {
                return undefined;
            }
            const model = this._instantiationService.createInstance(readHotReloadableExport(InlineEditsModel, reader), textModel, this._editorObs.versionId, this._selection, this._debounceValue);
            return model;
        });
        this._hadInlineEdit = derivedObservableWithCache(this, (reader, lastValue) => lastValue || this.model.read(reader)?.inlineEdit.read(reader) !== undefined);
        this._widget = derivedDisposable(this, reader => {
            if (!this._hadInlineEdit.read(reader)) {
                return undefined;
            }
            return this._instantiationService.createInstance(readHotReloadableExport(InlineEditsWidget, reader), this.editor, this.model.map((m, reader) => m?.inlineEdit.read(reader)), flattenSettableObservable((reader) => this.model.read(reader)?.userPrompt ?? observableValue('empty', '')));
        });
        this._register(bindContextKey(inlineEditVisible, this._contextKeyService, r => !!this.model.read(r)?.inlineEdit.read(r)));
        this._register(bindContextKey(isPinnedContextKey, this._contextKeyService, r => !!this.model.read(r)?.isPinned.read(r)));
        this.model.recomputeInitiallyAndOnChange(this._store);
        this._widget.recomputeInitiallyAndOnChange(this._store);
    }
};
InlineEditsController = InlineEditsController_1 = __decorate([
    __param(1, IInstantiationService),
    __param(2, IContextKeyService),
    __param(3, ILanguageFeatureDebounceService),
    __param(4, ILanguageFeaturesService),
    __param(5, IConfigurationService)
], InlineEditsController);
export { InlineEditsController };
function flattenSettableObservable(fn) {
    return derivedWithSetter(undefined, reader => {
        const obs = fn(reader);
        return obs.read(reader);
    }, (value, tx) => {
        fn(undefined).set(value, tx);
    });
}
