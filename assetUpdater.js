import { unlink, writeFile } from "node:fs/promises";
import { exec } from "node:child_process";
import { createWriteStream } from "node:fs";
import { get } from "node:https";
import { join } from "node:path";
import { promisify } from "node:util";
const LAUNCHER_ID = "VYTpXlbWo8";
const LANGUAGE = "en";
const URL = `https://${["sg", "hyp", "api"].join("-")}.hoyoverse.com/${["hyp", "hyp-connect", "api", "getAllGameBasicInfo"].join("/")}?launcher_id=${LAUNCHER_ID}&language=${LANGUAGE}`;
const execAsync = promisify(exec);
const downloadFile = (url, destPath) =>
    new Promise((resolve, reject) => {
        const file = createWriteStream(destPath);
        get(url, (response) => {
            response.pipe(file);
            file.on("finish", () => {
                file.close();
                resolve();
            });
            file.on("error", reject);
        }).on("error", reject);
    });
const getUrlExtension = (url) => url.split(/[#?]/)[0].split(".").pop().trim();
(async () => {
    const apiResponse = await fetch(URL);
    if (apiResponse.status !== 200) {
        console.error(`ERROR: API Returned non-OK response code of ${apiResponse.status}`);
        return;
    }
    const apiData = (await apiResponse.json()).data.game_info_list;
    const launcherAssets = {};
    for (let i = 0; i < 4; i += 1) {
        const gameName = apiData[i].game.biz.split("_")[0];
        console.log(`(${i + 1}/4) Updating ${gameName} assets`);
        launcherAssets[gameName] = { backgrounds: [] };
        let fileIndex = 0;
        await Promise.all(
            apiData[i].backgrounds.map(async (bgAsset) => {
                const imageURL = bgAsset.background.url;
                const videoURL = bgAsset.video.url;
                const backgroundEntry = { image: null, video: null };
                for (const [assetURL, assetType] of [
                    [imageURL, "image"],
                    [videoURL, "video"],
                ]) {
                    if (assetURL === "") {
                        continue;
                    }
                    const currentIndex = fileIndex++;
                    const fileExtension = getUrlExtension(assetURL);
                    const tempFileName = join("assets", gameName, `${gameName}-${currentIndex}-temp.${fileExtension}`);
                    await downloadFile(assetURL, tempFileName);
                    if (fileExtension === "webm") {
                        const outputPath = join("assets", gameName, `${gameName}-${currentIndex}.mp4`);
                        await execAsync(
                            `ffmpeg -y -i "${tempFileName}" -c:v libx264 -pix_fmt yuv420p -colorspace bt709 -color_primaries bt709 -color_trc iec61966-2-1 -tune animation -preset fast -movflags +faststart -c:a copy "${outputPath}"`
                        );
                        backgroundEntry.video = outputPath;
                    } else {
                        const outputPath = join("assets", gameName, `${gameName}-${currentIndex}.webp`);
                        await execAsync(
                            `ffmpeg -y -i "${tempFileName}" -lossless 1 -compression_level 6 "${outputPath}"`
                        );
                        backgroundEntry.image = outputPath;
                    }
                    await unlink(tempFileName);
                }
                launcherAssets[gameName].backgrounds.push(backgroundEntry);
            })
        );
    }
    await writeFile("launcherAssets.json", JSON.stringify(launcherAssets, null, 2));
    console.log("Done");
})();
