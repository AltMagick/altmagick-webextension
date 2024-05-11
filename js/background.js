const isFirefox = chrome.runtime.getURL("").startsWith("moz-extension://")

chrome.runtime.onInstalled.addListener(async (details) => {
    if (details.reason === "install") {
        await chrome.tabs.create({
            "url": chrome.runtime.getURL("dashboard.html")
        });
    }
});

let creating;

async function setupOffscreenDocument(path) {
    const offscreenUrl = chrome.runtime.getURL(path);
    const existingContexts = await chrome.runtime.getContexts({
        contextTypes: ["OFFSCREEN_DOCUMENT"],
        documentUrls: [offscreenUrl]
    });
    if (existingContexts.length > 0) {
        return;
    }
    if (creating) {
        await creating;
    } else {
        creating = chrome.offscreen.createDocument({
            url: path,
            reasons: ["CLIPBOARD"],
            justification: "Copy text to clipboard",
        });
        await creating;
        creating = null;
    }
}

async function generateAltText(imageUrl, sourceUrlIfBlob, licenseKey, language) {
    const localData = await new Promise(resolve =>
        chrome.storage.local.get("imageAltDB", resolve)
    );

    let localDataValue = localData.imageAltDB || {};

    if (sourceUrlIfBlob !== null) {
        if (sourceUrlIfBlob in localDataValue) {
            return localDataValue[sourceUrlIfBlob];
        }
    } else {
        if (imageUrl in localDataValue) {
            return localDataValue[imageUrl];
        }
    }

    const url = "https://api.altmagick.com/api/v1/analyse";
    const fetchRequest = {
        method: "POST",
        headers: {
            "Authorization": licenseKey,
            "X-ALT-Language": language,
            "Content-Type": "application/json"
        },
        body: JSON.stringify({imageUrl})
    };

    var response = await fetch(url, fetchRequest);
    var responseData = await response.json();

    if (response.status !== 200) {
        return responseData;
    } else {
        const altText = responseData.data.analyseText;
        const imagesdbTemp = (localData.imageAltDB || {});
        if (sourceUrlIfBlob !== null) {
            imagesdbTemp[sourceUrlIfBlob] = altText;
        } else {
            imagesdbTemp[imageUrl] = altText;
        }

        if (Object.keys(imagesdbTemp).length >= 100) {
            const oldestImageUrl = Object.keys(imagesdbTemp)[0];
            delete imagesdbTemp[oldestImageUrl];
        }

        await chrome.storage.local.set({imageAltDB: imagesdbTemp});
        await chrome.storage.local.set({usageCount: responseData.data.usageCount});
        return altText;
    }
}

async function initGenerateAltText(imageUrl, sourceUrlIfBlob) {
    chrome.storage.local.get(["licenseKey", "language"], async function (items) {
        if (items.licenseKey && (items.licenseKey !== "")) {
            if (items.language === "browser") {
                items.language = chrome.i18n.getUILanguage();
            }
            var response = await generateAltText(imageUrl, sourceUrlIfBlob, items.licenseKey, items.language);
            if (response.error) {
                showErrorNotification(response.error.message, false);
                return;
            }
            var data = {
                "type": "basic",
                "iconUrl": chrome.runtime.getURL("img/icon128.png"),
                "message": response,
                "title": "AltMagick: alt text copied to clipboard",
            }
            if (isFirefox) {
                await navigator.clipboard.writeText(response);
            } else {
                await setupOffscreenDocument("copy.html");
                await chrome.runtime.sendMessage({
                    type: "copy-clipboard",
                    target: "offscreen",
                    data: response
                });
            }
            chrome.notifications.create(data, function (id) {
                setTimeout(function () {
                    chrome.notifications.clear(id)
                }, 5000);
            });
        } else {
            showErrorNotification("AltMagick requires a licence to operate. Click to open settings.", true);
        }
    });
}

function showErrorNotification(message, optionsLink) {
    var data = {
        "type": "basic",
        "message": message,
        "iconUrl": chrome.runtime.getURL("img/icon128.png"),
        "title": "AltMagick: error",

    }
    let handleNotif = function (id) {
        chrome.notifications.onClicked.addListener(function (id) {
            if (optionsLink) {
                chrome.runtime.openOptionsPage();
            }
        })
    }
    chrome.notifications.create(data, handleNotif);
}

chrome.contextMenus.create({
    id: "generate-alt-text",
    title: "Generate alt text with AltMagick",
    contexts: ["image"]
});

chrome.contextMenus.onClicked.addListener(async function (info, tab) {
    if (info.menuItemId === "generate-alt-text") {
        const executeScriptOptions = {
            code: `(${async (info) => {
                return new Promise(async (resolve, reject) => {

                    const imageUrl = info.srcUrl;
                    const imageElement = document.querySelector(`img[src="${imageUrl}"]`);
                    if (!imageElement) {
                        reject(new Error("Image element not found"));
                        return;
                    }

                    const response = await fetch(imageUrl);
                    const blob = await response.blob();
                    const arrayBuffer = await blob.arrayBuffer();

                    let binary = "";
                    const bytes = new Uint8Array(arrayBuffer);
                    const len = bytes.byteLength;
                    for (let i = 0; i < len; i++) {
                        binary += String.fromCharCode(bytes[i]);
                    }
                    const base64Data = `data:${blob.type};base64,${window.btoa(binary)}`;

                    const img = new Image();
                    img.onload = function () {
                        const canvas = document.createElement("canvas");
                        const ctx = canvas.getContext("2d");

                        canvas.width = img.width;
                        canvas.height = img.height;

                        ctx.drawImage(img, 0, 0);

                        const compressedImage = canvas.toDataURL("image/jpeg", 0.7);
                        resolve(compressedImage);
                    };
                    img.src = base64Data;
                });
            }})(${JSON.stringify(info)})`
        };


        if (isFirefox) {
            browser.tabs.executeScript(tab.id, executeScriptOptions)
                .then(async injectionResults => {
                    if (chrome.runtime.lastError) {
                        showErrorNotification("An error occured", false)
                    } else {
                        const result = injectionResults[0];
                        if (result) {
                            await initGenerateAltText(result, info.srcUrl);
                        } else {
                            showErrorNotification("An error occured", false)
                        }
                    }
                });
        } else {
            chrome.scripting.executeScript({
                target: {tabId: tab.id, allFrames: true},
                func: async (info) => {
                    return new Promise(async (resolve, reject) => {
                        const imageUrl = info.srcUrl;
                        const imageElement = document.querySelector(`img[src="${imageUrl}"]`);
                        if (!imageElement) {
                            reject(new Error("Image element not found"));
                            return;
                        }

                        const response = await fetch(imageUrl);
                        const blob = await response.blob();
                        const arrayBuffer = await blob.arrayBuffer();

                        let binary = "";
                        const bytes = new Uint8Array(arrayBuffer);
                        const len = bytes.byteLength;
                        for (let i = 0; i < len; i++) {
                            binary += String.fromCharCode(bytes[i]);
                        }
                        const base64Data = `data:${blob.type};base64,${window.btoa(binary)}`;

                        const img = new Image();
                        img.onload = function () {
                            const canvas = document.createElement("canvas");
                            const ctx = canvas.getContext("2d");

                            canvas.width = img.width;
                            canvas.height = img.height;

                            ctx.drawImage(img, 0, 0);

                            const compressedImage = canvas.toDataURL("image/jpeg", 0.7);
                            resolve(compressedImage);
                        };
                        img.src = base64Data;
                    });
                },
                args: [info]
            })
                .then(async injectionResults => {
                    if (chrome.runtime.lastError) {
                        showErrorNotification("An error occured", false)
                    } else {
                        for (const frameResult of injectionResults) {
                            if (frameResult.result) {
                                await initGenerateAltText(frameResult.result, info.srcUrl);
                            } else {
                                showErrorNotification("An error occured", false)
                            }
                        }
                    }
                });
        }

    }
});


chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
    if (request.action === "closeOffscreen") {
        chrome.offscreen.closeDocument();
    }
})