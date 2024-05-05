document.querySelector("#version").textContent = chrome.runtime.getManifest().version;
document.querySelector("#name").textContent = chrome.runtime.getManifest().name;

const isFirefox = chrome.runtime.getURL("").startsWith("moz-extension://");
document.querySelector("#browser").textContent = isFirefox ? "Gecko" : "Blink";

const saveButton = document.getElementById("btn-save");
const licenseInput = document.querySelector("#licenseInput");
const languageSelect = document.querySelector("#languageSelect");
const infoModal = new bootstrap.Modal("#infoModal");
const modalTitle = document.querySelector("#modalTitle");
const modalContent = document.querySelector("#modalContent");
const subscriptionInfo = document.querySelector("#subscriptionInfo");
const userName = document.querySelector("#userName");
const userEmail = document.querySelector("#userEmail");
const renewsAt = document.querySelector("#renewsAt");
const endAt = document.querySelector("#endAt");
const status = document.querySelector("#status");
const reloadSubscriptionInfoBtn = document.querySelector("#reloadSubscriptionInfoBtn");
const usageInfo = document.querySelector("#usageInfo");
const progressContent = document.querySelector(".progress-content");
const progressRing = document.querySelector(".progress-ring__circle");
const radius = progressRing.r.baseVal.value;
const circumference = radius * 2 * Math.PI;
progressRing.style.strokeDasharray = `${circumference} ${circumference}`;
progressRing.style.strokeDashoffset = `${circumference}`;
const reloadUsageInfoBtn = document.querySelector("#reloadUsageInfoBtn");


document.addEventListener("DOMContentLoaded", function () {
    reloadSubscriptionInfoBtn.addEventListener("click", reloadSubscriptionInfo);
    reloadUsageInfoBtn.addEventListener("click", reloadUsageInfo);
    loadSettings()
        .then(() => {
            showSubscriptionInfo();
        });
    chrome.storage.local.get(["status"], function (items) {
        if (items.status !== "expired") {
            loadUsage()
                .then(() => {
                    showUsageInfo();
                });
        }
    });
});

saveButton.addEventListener("click", saveConfig);

async function saveConfig() {
    showSpinner();
    let licenseKey = licenseInput.value;
    checkLicense(licenseKey)
        .then(data => {
            if (data.error) {
                modalTitle.textContent = "Error";
                modalContent.textContent = data.error.message;
                infoModal.show();
                removeSpinner();
            } else {
                if (data.data) {
                    let licenseData = data.data;
                    saveSettings(licenseKey, licenseData.userName, licenseData.userEmail, licenseData.renewsAt, licenseData.endAt, licenseData.status, licenseData.cancelled, languageSelect.value)
                        .then(() => {
                            chrome.storage.local.set({imageAltDB: {}});
                            modalTitle.textContent = "Success";
                            modalContent.textContent = "Settings saved.";
                            infoModal.show();
                            removeSpinner();
                            showSubscriptionInfo();
                            if (licenseData.status !== "expired") {
                                loadUsage()
                                    .then(() => {
                                        showUsageInfo();
                                    });
                            }
                            welcome.classList.add("d-none");
                        })
                        .catch(error => {
                            modalTitle.textContent = "Error";
                            modalContent.textContent = error;
                            infoModal.show();
                            removeSpinner();
                        });
                }
            }

        })
        .catch(
            error => {
                modalTitle.textContent = "Error";
                modalContent.textContent = "An error occurred while checking the license. Please try again.";
                infoModal.show();
                removeSpinner();
            });
}

function checkLicense(licenseKey) {
    return fetch("https://api.altmagick.com/api/v1/license", {
        method: "GET",
        headers: {
            "Authorization": `${licenseKey}`
        }
    })
        .then(response => response.json())
        .then(data => {
            return data;
        })
}

function checkUsage(licenseKey) {
    return fetch("https://api.altmagick.com/api/v1/usage", {
        method: "GET",
        headers: {
            "Authorization": `${licenseKey}`
        }
    })
        .then(response => response.json())
        .then(data => {
            return data;
        })
}

function showSubscriptionInfo() {
    chrome.storage.local.get(["userName", "userEmail", "renewsAt", "endAt", "status"], function (items) {
        if (items.userName) {
            userName.textContent = items.userName;
            userName.parentElement.style.display = "table-row";
        } else {
            userName.parentElement.style.display = "none";
        }

        if (items.userEmail) {
            userEmail.textContent = items.userEmail;
            userEmail.parentElement.style.display = "table-row";
        } else {
            userEmail.parentElement.style.display = "none";
        }

        if (items.renewsAt && items.status !== "expired") {
            let date = new Date(items.renewsAt.seconds * 1000);
            renewsAt.textContent = date.toLocaleDateString();
            renewsAt.parentElement.style.display = "table-row";
        } else {
            renewsAt.parentElement.style.display = "none";
        }

        if (items.endAt) {
            endAt.textContent = items.endAt;
            endAt.parentElement.style.display = "table-row";
        } else {
            endAt.parentElement.style.display = "none";
        }

        if (items.status) {
            status.textContent = items.status;
            status.parentElement.style.display = "table-row";
        } else {
            status.parentElement.style.display = "none";
        }

        if (items.userName || items.userEmail || items.renewsAt || items.endAt || items.status) {
            subscriptionInfo.classList.remove("d-none");
        } else {
            subscriptionInfo.classList.add("d-none");
        }
    });

}

function showUsageInfo() {
    chrome.storage.local.get(["usageCount", "maxAllowedUsageCount"], function (items) {
        if (items.usageCount && items.maxAllowedUsageCount) {
            progressContent.innerHTML = items.usageCount + "<br>on<br>" + items.maxAllowedUsageCount;
            progressRing.style.strokeDashoffset = `${circumference - (items.usageCount / items.maxAllowedUsageCount) * circumference}`;
            usageInfo.classList.remove("d-none");
        } else {
            usageInfo.classList.add("d-none");
        }
    });

}

function reloadUsageInfo() {
    const svgElement = document.querySelector("#reloadUsageInfoBtn svg");

    svgElement.classList.add("rotate");

    chrome.storage.local.get(["licenseKey"], function (items) {
        if (items.licenseKey) {
            checkUsage(items.licenseKey)
                .then(data => {
                    if (data.error) {
                        modalTitle.textContent = "Error";
                        modalContent.textContent = data.error.message;
                        infoModal.show();
                    } else {
                        if (data.data) {
                            usageData = data.data;
                            saveUsage(usageData.usageCount, usageData.maxAllowedUsageCount)
                                .then(() => {
                                    showUsageInfo();
                                })
                                .catch(error => {
                                    modalTitle.textContent = "Error";
                                    modalContent.textContent = error;
                                    infoModal.show();
                                });
                        }
                    }
                    svgElement.classList.remove("rotate");
                })
                .catch(error => {
                    modalTitle.textContent = "Error";
                    modalContent.textContent = "An error occurred while checking the usage. Please try again.";
                    infoModal.show();

                    svgElement.classList.remove("rotate");
                });
        } else {
            svgElement.classList.remove("rotate");
        }
    });

}

function loadUsage() {
    showSpinner();
    return new Promise((resolve, reject) => {
        chrome.storage.local.get(["licenseKey"], function (items) {
            if (items.licenseKey) {
                checkUsage(items.licenseKey)
                    .then(data => {
                        if (data.error) {
                            modalTitle.textContent = "Error";
                            modalContent.textContent = data.error.message;
                            infoModal.show();
                            removeSpinner();
                            reject(data.error);
                        } else {
                            if (data.data) {
                                usageData = data.data;
                                saveUsage(usageData.usageCount, usageData.maxAllowedUsageCount)
                                    .then(() => {
                                        removeSpinner();
                                        resolve();
                                    })
                                    .catch(error => {
                                        modalTitle.textContent = "Error";
                                        modalContent.textContent = error;
                                        infoModal.show();
                                        removeSpinner();
                                        reject(error);
                                    });
                            }
                        }
                    })
                    .catch(error => {
                        modalTitle.textContent = "Error";
                        modalContent.textContent = "An error occurred while checking the usage. Please try again.";
                        infoModal.show();
                        removeSpinner();
                        reject(error);
                    });
            } else {
                removeSpinner();
                resolve();
            }
        });
    });

}

function reloadSubscriptionInfo() {
    const svgElement = document.querySelector("#reloadSubscriptionInfoBtn svg");

    svgElement.classList.add("rotate");

    chrome.storage.local.get(["licenseKey"], function (items) {
        if (items.licenseKey) {
            checkLicense(items.licenseKey)
                .then(data => {
                    if (data.error) {
                        modalTitle.textContent = "Error";
                        modalContent.textContent = data.error.message;
                        infoModal.show();
                    } else {
                        if (data.data) {
                            saveSettings(items.licenseKey, data.data.userName, data.data.userEmail, data.data.renewsAt, data.data.endAt, data.data.status, data.data.cancelled, languageSelect.value)
                                .then(() => {
                                    showSubscriptionInfo();
                                })
                                .catch(error => {
                                    modalTitle.textContent = "Error";
                                    modalContent.textContent = error;
                                    infoModal.show();
                                });
                        }
                    }
                    svgElement.classList.remove("rotate");
                })
                .catch(error => {
                    modalTitle.textContent = "Error";
                    modalContent.textContent = "An error occurred while checking the license. Please try again.";
                    infoModal.show();

                    svgElement.classList.remove("rotate");
                });
        } else {
            svgElement.classList.remove("rotate");
        }
    });
}

function saveSettings(licenseKey, userName, userEmail, renewsAt, endAt, status, cancelled, language) {
    return new Promise((resolve, reject) => {
        chrome.storage.local.set({
            licenseKey,
            userName,
            userEmail,
            renewsAt,
            endAt,
            status,
            cancelled,
            language
        }, function () {
            if (chrome.runtime.lastError) {
                reject(chrome.runtime.lastError);
            } else {
                resolve("Settings saved.");
            }
        });
    });
}

function saveUsage(usageCount, maxAllowedUsageCount) {
    return new Promise((resolve, reject) => {
        chrome.storage.local.set({
            usageCount,
            maxAllowedUsageCount
        }, function () {
            if (chrome.runtime.lastError) {
                reject(chrome.runtime.lastError);
            } else {
                resolve("Usage saved.");
            }
        });
    });
}

function loadSettings() {
    showSpinner();
    return new Promise((resolve, reject) => {
        chrome.storage.local.get(["licenseKey"], function (items) {
            if (items.licenseKey) {
                checkLicense(items.licenseKey)
                    .then(data => {
                        if (data.error) {
                            modalTitle.textContent = "Error";
                            modalContent.textContent = data.error.message;
                            infoModal.show();
                            removeSpinner();
                            reject(data.error);
                        } else {
                            if (data.data) {
                                licenseInput.value = items.licenseKey;
                                saveSettings(items.licenseKey, data.data.userName, data.data.userEmail, data.data.renewsAt, data.data.endAt, data.data.status, data.data.cancelled, languageSelect.value);
                                removeSpinner();
                                resolve();
                            }
                        }
                    })
                    .catch(error => {
                        modalTitle.textContent = "Error";
                        modalContent.textContent = "An error occurred while checking the license. Please try again.";
                        infoModal.show();
                        removeSpinner();
                        reject(error);
                    });
            } else {
                welcome.classList.remove("d-none");
                removeSpinner();
                resolve();
            }
        });
        chrome.storage.local.get(["licenseKey", "language"], function (items) {
            languageSelect.value = items.language || "browser";
            licenseInput.value = items.licenseKey || "";
        });
    });
}

function showSpinner() {
    document.getElementById("main").style.transition = "opacity 0.4s";
    document.getElementById("main").style.opacity = "0.35";
    document.getElementById("main").style.pointerEvents = "none";
    document.getElementsByClassName("spinner-container")[0].style.transition = "opacity 0.4s";
    document.getElementsByClassName("spinner-container")[0].style.visibility = "visible";
    document.getElementsByClassName("spinner-container")[0].style.opacity = "1";
}

function removeSpinner() {
    document.getElementById("main").style.transition = "opacity 0.4s";
    document.getElementById("main").style.opacity = "1";
    document.getElementById("main").style.pointerEvents = "all";
    document.getElementsByClassName("spinner-container")[0].style.transition = "opacity 0.4s";
    document.getElementsByClassName("spinner-container")[0].style.opacity = "0";
    document.getElementsByClassName("spinner-container")[0].style.visibility = "hidden";
}
