/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
export class HoverResult {
    constructor(anchor, hoverParts, isComplete) {
        this.anchor = anchor;
        this.hoverParts = hoverParts;
        this.isComplete = isComplete;
    }
    filter(anchor) {
        const filteredHoverParts = this.hoverParts.filter((m) => m.isValidForHoverAnchor(anchor));
        if (filteredHoverParts.length === this.hoverParts.length) {
            return this;
        }
        return new FilteredHoverResult(this, this.anchor, filteredHoverParts, this.isComplete);
    }
}
export class FilteredHoverResult extends HoverResult {
    constructor(original, anchor, messages, isComplete) {
        super(anchor, messages, isComplete);
        this.original = original;
    }
    filter(anchor) {
        return this.original.filter(anchor);
    }
}
