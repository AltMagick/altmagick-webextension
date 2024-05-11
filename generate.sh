#!/bin/bash

commit_hash=$(git rev-parse --short HEAD)

if [ -f altmagick_chrome_*.zip ]; then
    rm altmagick_chrome_*.zip
fi

if [ -f altmagick_firefox_*.zip ]; then
    rm altmagick_firefox_*.zip
fi

cp manifest-chrome.json manifest.json
zip -r altmagick_chrome_$commit_hash.zip css/ img/ js/ copy.html dashboard.html favicon.ico manifest.json popup.html
rm manifest.json

cp manifest-firefox.json manifest.json
zip -r altmagick_firefox_$commit_hash.zip css/ img/ js/ copy.html dashboard.html favicon.ico manifest.json popup.html
rm manifest.json