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

async function generateAltText(imageUrl, licenseKey, language) {
    const localData = await new Promise(resolve =>
        chrome.storage.local.get('imageAltDB', resolve)
    );

    let localDataValue = localData.imageAltDB || {};

    if (imageUrl in localDataValue) {
        return localDataValue[imageUrl];
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
        imagesdbTemp[imageUrl] = altText;

        if (Object.keys(imagesdbTemp).length >= 100) {
            const oldestImageUrl = Object.keys(imagesdbTemp)[0];
            delete imagesdbTemp[oldestImageUrl];
        }

        await chrome.storage.local.set({imageAltDB: imagesdbTemp});
        await chrome.storage.local.set({usageCount: responseData.data.usageCount});
        return altText;
    }
}

async function initGenerateAltText(imageUrl) {
    chrome.storage.local.get(["licenseKey", "language"], async function (items) {
        if (items.licenseKey && (items.licenseKey !== "")) {
            if (items.language === "browser") {
                items.language = chrome.i18n.getUILanguage();
            }
            var response = await generateAltText(imageUrl, items.licenseKey, items.language);
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
    handleNotif = function (id) {
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
        initGenerateAltText(info.srcUrl);
    }
});

chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
    if (request.action === "closeOffscreen") {
        chrome.offscreen.closeDocument();
    }
})