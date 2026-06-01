import { exec } from "node:child_process";
import { createHash } from "node:crypto";
import { createReadStream, createWriteStream, readdirSync, renameSync, unlinkSync } from "node:fs";
import { unlink, writeFile } from "node:fs/promises";
import { get } from "node:https";
import { join } from "node:path";
import { promisify } from "node:util";

export const execAsync = promisify(exec);
export const getUrlExtension = (url) => url.split(/[#?]/)[0].split(".").pop().trim();
export const getUrlFileName = (url) => url.split("/").pop().trim();

export const downloadFile = (url, destPath) => {
    return new Promise((resolve, reject) => {
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
}

export const computeFileHash = async (path) => {
    return new Promise((resolve, reject) => {
        const hash = createHash("sha256");
        const stream = createReadStream(path);

        stream.on("data", (c) => hash.update(c))
        stream.on("end", () => resolve(hash.digest("hex")));
        stream.on("error", reject);
    })
}

export const ffmpegFilters = {
    webp: "-lossless 1 -compression_level 6",
    webm: "-c:v libx264 -pix_fmt yuv420p -colorspace bt709 -color_primaries bt709 -color_trc iec61966-2-1 -tune animation -preset fast -movflags +faststart -c:a copy"
}


const LAUNCHER_ID = "VYTpXlbWo8";
const LANGUAGE = "en";
const URL = `https://${["sg", "hyp", "api"].join("-")}.hoyoverse.com/${["hyp", "hyp-connect", "api", "getAllGameBasicInfo"].join("/")}?launcher_id=${LAUNCHER_ID}&language=${LANGUAGE}`;

const updateAssets = async () => {
    const apiResponse = await fetch(URL);
    if (apiResponse.status !== 200) {
        console.error(`ERROR: API Returned non-OK response code of ${apiResponse.status}`);
        return;
    }
    const apiData = (await apiResponse.json()).data.game_info_list;
    const launcherAssets = {};
    await Promise.all(["nap", "hkrpg", "hk4e", "bh3"].map(async (gameCode, index) => {
        const outputPath = join("assets", gameCode);
        const backgrounds = apiData[index].backgrounds;

        await Promise.all(readdirSync(outputPath).map(async (file) => {
            await unlink(join(outputPath, file));
        }));

        launcherAssets[gameCode] = [];

        await Promise.all(backgrounds.map(async (bgAsset) => {
            const imageUrl = bgAsset.background.url;
            const videoUrl = bgAsset.video.url;
            const backgroundEntry = { image: null, video: null };
            const outputDir = join("assets", gameCode);

            for (const [assetURL] of [[imageUrl, "image"], [videoUrl, "video"]]) {
                if (assetURL === "") continue;
                const tempFileName = getUrlFileName(assetURL);
                const ext = getUrlExtension(assetURL);
                const outputExt = ext === "webm" ? "mp4" : ext;

                // Will be renamed to sha256 hash once processed, so it's ok to use the md5 hash for the original file as the temp file name
                const initialFileName = join(outputDir, tempFileName);
                const preHashFileName = join(outputDir, `${crypto.randomUUID()}.${outputExt}`);

                await downloadFile(assetURL, initialFileName);
                await execAsync(`ffmpeg -y -i "${initialFileName}" ${ffmpegFilters[`${ext}`]} ${preHashFileName}`);
                unlinkSync(initialFileName);

                const finalHash = await computeFileHash(preHashFileName);
                const hashedName = join(outputDir, `${finalHash}.${outputExt}`);

                renameSync(preHashFileName, hashedName);
                backgroundEntry[outputExt === "mp4" ? "video" : "image"] = hashedName;
            }
            launcherAssets[gameCode].push(backgroundEntry)
        }))
    }));

    await writeFile("launcherAssets.json", JSON.stringify(launcherAssets, null, 2));
    console.log("Done");
}
(async () => await updateAssets())();
