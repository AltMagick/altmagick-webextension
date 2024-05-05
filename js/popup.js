document.querySelector("#name").textContent = chrome.runtime.getManifest().name;
const usageInfo = document.querySelector("#usageInfo");
const licenseExpired = document.querySelector("#licenseExpired");
const welcome = document.querySelector("#welcome");
const progressContent = document.querySelector(".progress-content");
const progressRing = document.querySelector(".progress-ring__circle");
const radius = progressRing.r.baseVal.value;
const circumference = radius * 2 * Math.PI;
progressRing.style.strokeDasharray = `${circumference} ${circumference}`;
progressRing.style.strokeDashoffset = `${circumference}`;
const reloadUsageInfoBtn = document.querySelector("#reloadUsageInfoBtn");
const infoModal = new bootstrap.Modal("#infoModal");

document.addEventListener("DOMContentLoaded", function () {
    document.getElementById("openOptions").addEventListener("click", function () {
        chrome.runtime.openOptionsPage();
        window.close();
    });
    loadSettings();
    chrome.storage.local.get(["status"], function (items) {
        if (items.status !== "expired") {
            loadUsage()
                .then(() => {
                    showUsageInfo();
                });
        }
    });

});

reloadUsageInfoBtn.addEventListener("click", reloadUsageInfo);

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
                                        resolve();
                                        removeSpinner();
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
                                if (data.data.status === "expired") {
                                    licenseExpired.classList.remove("d-none");
                                }
                                saveSettings(items.licenseKey, data.data.userName, data.data.userEmail, data.data.renewsAt, data.data.endAt, data.data.status, data.data.cancelled);
                                removeSpinner();
                                resolve();
                            }
                        }
                    })
                    .catch(error => {
                        modalTitle.textContent = "Error";
                        modalContent.textContent = "An error occurred while checking the license. Please try again.";
                        infoModal.show()
                        removeSpinner();
                        reject(error);
                    });
            } else {
                welcome.classList.remove("d-none");
                removeSpinner();
                resolve();
            }
        });
    });
}

function saveSettings(licenseKey, userName, userEmail, renewsAt, endAt, status, cancelled) {
    return new Promise((resolve, reject) => {
        chrome.storage.local.set({
            licenseKey,
            userName,
            userEmail,
            renewsAt,
            endAt,
            status,
            cancelled
        }, function () {
            if (chrome.runtime.lastError) {
                reject(chrome.runtime.lastError);
            } else {
                resolve("Settings saved.");
            }
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
