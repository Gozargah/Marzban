/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { createTrustedTypesPolicy } from './trustedTypes.js';
import { onUnexpectedError } from '../common/errors.js';
import { COI, FileAccess } from '../common/network.js';
import { logOnceWebWorkerWarning, SimpleWorkerClient } from '../common/worker/simpleWorker.js';
import { Disposable, toDisposable } from '../common/lifecycle.js';
import { coalesce } from '../common/arrays.js';
import { getNLSLanguage, getNLSMessages } from '../../nls.js';
// ESM-comment-begin
// const isESM = false;
// ESM-comment-end
// ESM-uncomment-begin
const isESM = true;
// ESM-uncomment-end
// Reuse the trusted types policy defined from worker bootstrap
// when available.
// Refs https://github.com/microsoft/vscode/issues/222193
let ttPolicy;
if (typeof self === 'object' && self.constructor && self.constructor.name === 'DedicatedWorkerGlobalScope' && globalThis.workerttPolicy !== undefined) {
    ttPolicy = globalThis.workerttPolicy;
}
else {
    ttPolicy = createTrustedTypesPolicy('defaultWorkerFactory', { createScriptURL: value => value });
}
function getWorker(esmWorkerLocation, label) {
    const monacoEnvironment = globalThis.MonacoEnvironment;
    if (monacoEnvironment) {
        if (typeof monacoEnvironment.getWorker === 'function') {
            return monacoEnvironment.getWorker('workerMain.js', label);
        }
        if (typeof monacoEnvironment.getWorkerUrl === 'function') {
            const workerUrl = monacoEnvironment.getWorkerUrl('workerMain.js', label);
            return new Worker(ttPolicy ? ttPolicy.createScriptURL(workerUrl) : workerUrl, { name: label, type: isESM ? 'module' : undefined });
        }
    }
    // ESM-comment-begin
    // 	if (typeof require === 'function') {
    // 		const workerMainLocation = require.toUrl('vs/base/worker/workerMain.js'); // explicitly using require.toUrl(), see https://github.com/microsoft/vscode/issues/107440#issuecomment-698982321
    // 		const factoryModuleId = 'vs/base/worker/defaultWorkerFactory.js';
    // 		const workerBaseUrl = require.toUrl(factoryModuleId).slice(0, -factoryModuleId.length); // explicitly using require.toUrl(), see https://github.com/microsoft/vscode/issues/107440#issuecomment-698982321
    // 		const workerUrl = getWorkerBootstrapUrl(label, workerMainLocation, workerBaseUrl);
    // 		return new Worker(ttPolicy ? ttPolicy.createScriptURL(workerUrl) as unknown as string : workerUrl, { name: label, type: isESM ? 'module' : undefined });
    // 	}
    // ESM-comment-end
    if (esmWorkerLocation) {
        const workerUrl = getWorkerBootstrapUrl(label, esmWorkerLocation.toString(true));
        const worker = new Worker(ttPolicy ? ttPolicy.createScriptURL(workerUrl) : workerUrl, { name: label, type: isESM ? 'module' : undefined });
        if (isESM) {
            return whenESMWorkerReady(worker);
        }
        else {
            return worker;
        }
    }
    throw new Error(`You must define a function MonacoEnvironment.getWorkerUrl or MonacoEnvironment.getWorker`);
}
function getWorkerBootstrapUrl(label, workerScriptUrl, workerBaseUrl) {
    const workerScriptUrlIsAbsolute = /^((http:)|(https:)|(file:)|(vscode-file:))/.test(workerScriptUrl);
    if (workerScriptUrlIsAbsolute && workerScriptUrl.substring(0, globalThis.origin.length) !== globalThis.origin) {
        // this is the cross-origin case
        // i.e. the webpage is running at a different origin than where the scripts are loaded from
    }
    else {
        const start = workerScriptUrl.lastIndexOf('?');
        const end = workerScriptUrl.lastIndexOf('#', start);
        const params = start > 0
            ? new URLSearchParams(workerScriptUrl.substring(start + 1, ~end ? end : undefined))
            : new URLSearchParams();
        COI.addSearchParam(params, true, true);
        const search = params.toString();
        if (!search) {
            workerScriptUrl = `${workerScriptUrl}#${label}`;
        }
        else {
            workerScriptUrl = `${workerScriptUrl}?${params.toString()}#${label}`;
        }
    }
    if (!isESM && !workerScriptUrlIsAbsolute) {
        // we have to convert relative script URLs to the origin because importScripts
        // does not work unless the script URL is absolute
        workerScriptUrl = new URL(workerScriptUrl, globalThis.origin).toString();
    }
    const blob = new Blob([coalesce([
            `/*${label}*/`,
            workerBaseUrl ? `globalThis.MonacoEnvironment = { baseUrl: '${workerBaseUrl}' };` : undefined,
            `globalThis._VSCODE_NLS_MESSAGES = ${JSON.stringify(getNLSMessages())};`,
            `globalThis._VSCODE_NLS_LANGUAGE = ${JSON.stringify(getNLSLanguage())};`,
            `globalThis._VSCODE_FILE_ROOT = '${globalThis._VSCODE_FILE_ROOT}';`,
            `const ttPolicy = globalThis.trustedTypes?.createPolicy('defaultWorkerFactory', { createScriptURL: value => value });`,
            `globalThis.workerttPolicy = ttPolicy;`,
            isESM ? `await import(ttPolicy?.createScriptURL('${workerScriptUrl}') ?? '${workerScriptUrl}');` : `importScripts(ttPolicy?.createScriptURL('${workerScriptUrl}') ?? '${workerScriptUrl}');`,
            isESM ? `globalThis.postMessage({ type: 'vscode-worker-ready' });` : undefined, // in ESM signal we are ready after the async import
            `/*${label}*/`
        ]).join('')], { type: 'application/javascript' });
    return URL.createObjectURL(blob);
}
function whenESMWorkerReady(worker) {
    return new Promise((resolve, reject) => {
        worker.onmessage = function (e) {
            if (e.data.type === 'vscode-worker-ready') {
                worker.onmessage = null;
                resolve(worker);
            }
        };
        worker.onerror = reject;
    });
}
function isPromiseLike(obj) {
    if (typeof obj.then === 'function') {
        return true;
    }
    return false;
}
/**
 * A worker that uses HTML5 web workers so that is has
 * its own global scope and its own thread.
 */
class WebWorker extends Disposable {
    constructor(esmWorkerLocation, amdModuleId, id, label, onMessageCallback, onErrorCallback) {
        super();
        this.id = id;
        this.label = label;
        const workerOrPromise = getWorker(esmWorkerLocation, label);
        if (isPromiseLike(workerOrPromise)) {
            this.worker = workerOrPromise;
        }
        else {
            this.worker = Promise.resolve(workerOrPromise);
        }
        this.postMessage(amdModuleId, []);
        this.worker.then((w) => {
            w.onmessage = function (ev) {
                onMessageCallback(ev.data);
            };
            w.onmessageerror = onErrorCallback;
            if (typeof w.addEventListener === 'function') {
                w.addEventListener('error', onErrorCallback);
            }
        });
        this._register(toDisposable(() => {
            this.worker?.then(w => {
                w.onmessage = null;
                w.onmessageerror = null;
                w.removeEventListener('error', onErrorCallback);
                w.terminate();
            });
            this.worker = null;
        }));
    }
    getId() {
        return this.id;
    }
    postMessage(message, transfer) {
        this.worker?.then(w => {
            try {
                w.postMessage(message, transfer);
            }
            catch (err) {
                onUnexpectedError(err);
                onUnexpectedError(new Error(`FAILED to post message to '${this.label}'-worker`, { cause: err }));
            }
        });
    }
}
export class WorkerDescriptor {
    constructor(amdModuleId, label) {
        this.amdModuleId = amdModuleId;
        this.label = label;
        this.esmModuleLocation = (isESM ? FileAccess.asBrowserUri(`${amdModuleId}.esm.js`) : undefined);
    }
}
class DefaultWorkerFactory {
    static { this.LAST_WORKER_ID = 0; }
    constructor() {
        this._webWorkerFailedBeforeError = false;
    }
    create(desc, onMessageCallback, onErrorCallback) {
        const workerId = (++DefaultWorkerFactory.LAST_WORKER_ID);
        if (this._webWorkerFailedBeforeError) {
            throw this._webWorkerFailedBeforeError;
        }
        return new WebWorker(desc.esmModuleLocation, desc.amdModuleId, workerId, desc.label || 'anonymous' + workerId, onMessageCallback, (err) => {
            logOnceWebWorkerWarning(err);
            this._webWorkerFailedBeforeError = err;
            onErrorCallback(err);
        });
    }
}
export function createWebWorker(arg0, arg1) {
    const workerDescriptor = (typeof arg0 === 'string' ? new WorkerDescriptor(arg0, arg1) : arg0);
    return new SimpleWorkerClient(new DefaultWorkerFactory(), workerDescriptor);
}
