/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { TreeSitterTokenizationRegistry } from '../languages.js';
import { LineTokens } from '../tokens/lineTokens.js';
import { AbstractTokens } from './tokens.js';
export class TreeSitterTokens extends AbstractTokens {
    constructor(_treeSitterService, languageIdCodec, textModel, languageId) {
        super(languageIdCodec, textModel, languageId);
        this._treeSitterService = _treeSitterService;
        this._tokenizationSupport = null;
        this._initialize();
    }
    _initialize() {
        const newLanguage = this.getLanguageId();
        if (!this._tokenizationSupport || this._lastLanguageId !== newLanguage) {
            this._lastLanguageId = newLanguage;
            this._tokenizationSupport = TreeSitterTokenizationRegistry.get(newLanguage);
        }
    }
    getLineTokens(lineNumber) {
        const content = this._textModel.getLineContent(lineNumber);
        if (this._tokenizationSupport) {
            const rawTokens = this._tokenizationSupport.tokenizeEncoded(lineNumber, this._textModel);
            if (rawTokens) {
                return new LineTokens(rawTokens, content, this._languageIdCodec);
            }
        }
        return LineTokens.createEmpty(content, this._languageIdCodec);
    }
    resetTokenization(fireTokenChangeEvent = true) {
        if (fireTokenChangeEvent) {
            this._onDidChangeTokens.fire({
                semanticTokensApplied: false,
                ranges: [
                    {
                        fromLineNumber: 1,
                        toLineNumber: this._textModel.getLineCount(),
                    },
                ],
            });
        }
        this._initialize();
    }
    handleDidChangeAttached() {
        // TODO @alexr00 implement for background tokenization
    }
    handleDidChangeContent(e) {
        if (e.isFlush) {
            // Don't fire the event, as the view might not have got the text change event yet
            this.resetTokenization(false);
        }
    }
    forceTokenization(lineNumber) {
        // TODO @alexr00 implement
    }
    hasAccurateTokensForLine(lineNumber) {
        // TODO @alexr00 update for background tokenization
        return true;
    }
    isCheapToTokenize(lineNumber) {
        // TODO @alexr00 update for background tokenization
        return true;
    }
    getTokenTypeIfInsertingCharacter(lineNumber, column, character) {
        // TODO @alexr00 implement once we have custom parsing and don't just feed in the whole text model value
        return 0 /* StandardTokenType.Other */;
    }
    tokenizeLineWithEdit(position, length, newText) {
        // TODO @alexr00 understand what this is for and implement
        return null;
    }
    get hasTokens() {
        // TODO @alexr00 once we have a token store, implement properly
        const hasTree = this._treeSitterService.getParseResult(this._textModel) !== undefined;
        return hasTree;
    }
}
