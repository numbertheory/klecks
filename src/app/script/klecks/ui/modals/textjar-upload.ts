import { BB } from '../../../bb/bb';
import { KL } from '../../kl';
import { KlCanvas } from '../../canvas/kl-canvas';
import { LANG } from '../../../language/language';
import { canvasToBlob } from '../../../bb/base/canvas';
import { css } from '../../../bb/base/base';

type TTextjarUploadResponse = {
    message: string;
    files: string[];
};

async function uploadToTextjar(
    canvas: HTMLCanvasElement,
    filename: string,
    type: 'png' | 'jpeg',
    endpointUrl: string,
): Promise<TTextjarUploadResponse> {
    const mimeType = 'image/' + type;
    const imageBlob = await canvasToBlob(canvas, mimeType);

    const formData = new FormData();
    // Textjar expects the file key to be "photos"
    formData.append('photos', imageBlob, filename);

    const response = await fetch(endpointUrl, {
        method: 'POST',
        body: formData,
        credentials: 'include', // Support Cloudflare Access authentication cookies
    });

    if (!response.ok) {
        let errMsg = 'HTTP Error ' + response.status;
        try {
            const errData = await response.json();
            if (errData && errData.error) {
                errMsg = errData.error;
            }
        } catch (e) {}
        throw new Error(errMsg);
    }

    return await response.json();
}

export function textjarUpload(
    klCanvas: KlCanvas,
    klRootEl: HTMLElement,
    onUploaded: () => void,
): void {
    const LS_KEY = 'kl-textjar-endpoint';
    const guessedUrl = window.location.origin.includes('5050')
        ? window.location.origin.replace(':5050', ':3636') + '/v1/api/photos'
        : window.location.origin.replace('klecks', 'textjar') + '/v1/api/photos';
    const initEndpointUrl = localStorage.getItem(LS_KEY) || guessedUrl;

    const inputFilename = BB.el({ tagName: 'input', custom: { name: 'image-filename' } });
    inputFilename.type = 'text';
    inputFilename.value = 'drawing';

    const inputEndpoint = BB.el({
        tagName: 'input',
        custom: { name: 'textjar-endpoint' },
        css: {
            width: '100%',
        },
    });
    inputEndpoint.type = 'text';
    inputEndpoint.value = initEndpointUrl;

    const labelFilename = BB.el({
        textContent: LANG('upload-name') + ':',
        css: {
            marginTop: '10px',
        },
    });
    const labelEndpoint = BB.el({
        textContent: 'Textjar API Endpoint:',
        css: {
            marginTop: '10px',
        },
    });

    const typeRadio = new KL.RadioList({
        name: 'filetype',
        init: 'jpeg',
        items: [
            { label: 'JPG', value: 'jpeg' },
            { label: 'PNG', value: 'png' },
        ],
        ignoreFocus: true,
    });
    css(typeRadio.getElement(), {
        marginBottom: '10px',
    });

    const outDiv = BB.el();
    outDiv.append(
        typeRadio.getElement(),
        labelFilename,
        inputFilename,
        labelEndpoint,
        inputEndpoint,
    );

    KL.popup({
        message: `<b>Save to Textjar</b>`,
        type: 'upload',
        div: outDiv,
        buttons: ['Save', 'Cancel'],
        clickOnEnter: 'Save',
        primaries: ['Save'],
        autoFocus: 'Save',
        callback: async function (val) {
            if (val === 'Save') {
                const endpoint = inputEndpoint.value.trim();
                localStorage.setItem(LS_KEY, endpoint);

                const format = typeRadio.getValue() as 'png' | 'jpeg';
                const extension = format === 'jpeg' ? 'jpg' : 'png';
                let filename = inputFilename.value.trim();
                if (!filename) {
                    filename = 'drawing';
                }
                if (!filename.endsWith('.' + extension)) {
                    filename += '.' + extension;
                }

                // Show basic loading status
                let closeLoading: (() => void) | undefined;
                KL.popup({
                    type: 'ok',
                    message: 'Uploading to Textjar...',
                    buttons: [],
                    closeFunc: (close) => {
                        closeLoading = close;
                    },
                });

                try {
                    const result = await uploadToTextjar(
                        klCanvas.getCompleteCanvas(1),
                        filename,
                        format,
                        endpoint,
                    );

                    // Close loading popup
                    if (closeLoading) {
                        closeLoading();
                    }

                    KL.popup({
                        type: 'ok',
                        message: `<h3>Upload Success!</h3><br>Saved as: <b>${result.files[0]}</b>`,
                        buttons: ['Ok'],
                    });
                    onUploaded();
                } catch (e: any) {
                    if (closeLoading) {
                        closeLoading();
                    }
                    KL.popup({
                        type: 'error',
                        message: `Upload Failed:<br><b>${e.message || 'Connection error'}</b>`,
                        buttons: ['Ok'],
                    });
                }
            }
        },
    });
}
