import { unlink } from 'node:fs/promises';
import { exec } from 'node:child_process';
import { createWriteStream } from 'node:fs';
import { get } from 'node:https';
import { join } from 'node:path';
import { promisify } from 'node:util';
const LAUNCHER_ID = "VYTpXlbWo8";
const LANGUAGE = "en";
const URL = `https://${["sg", "hyp", "api"].join("-")}.hoyoverse.com/${["hyp", "hyp-connect", "api", "getAllGameBasicInfo"].join("/")}?launcher_id=${LAUNCHER_ID}&language=${LANGUAGE}`
const execAsync = promisify(exec);
const downloadFile = (url, destPath) => new Promise((resolve, reject) => {
  const file = createWriteStream(destPath);
  get(url, (response) => {
    response.pipe(file);
    file.on("finish", () => { file.close(); resolve(); });
    file.on("error", reject);
  }).on("error", reject);
});
const getUrlExtension = (url) => url.split(/[#?]/)[0].split(".").pop().trim(); 
(async() => {
    const apiResponse = await fetch(URL);
    if(apiResponse.status === 200) {
        const apiData = (await apiResponse.json()).data.game_info_list;
        for(let i = 0; i < 4; i++) {
            const gameName = apiData[i].game.biz.split("_")[0];
            console.log(`(${i + 1}/4) Updating ${gameName} assets`);
            await Promise.all(apiData[i].backgrounds.map(async(bgAsset, index) => {
                const imageURL = bgAsset.background.url;
                const videoURL = bgAsset.video.url;
                await Promise.all([imageURL, videoURL].map(async(assetURL) => {
                    if(assetURL === "") return;
                    const fileExtension = getUrlExtension(assetURL);
                    const tempFileName = join("assets", gameName, `${gameName}-${index}-temp.${fileExtension}`);  
                    await downloadFile(assetURL, tempFileName);
                    if(fileExtension === 'webm') await execAsync(`ffmpeg -y -i "${tempFileName}" -vcodec libx264 -tune animation "${join("assets", gameName, `${gameName}-${index}.mp4`)}"`);
                    else await execAsync(`ffmpeg -y -i "${tempFileName}" -lossless 1 -compression_level 6 "${join("assets", gameName, `${gameName}-${index}.webp`)}"`);
                    await unlink(tempFileName);
                }));
            }));
        }
        console.log("Done");
    }
    else console.error(`ERROR: API Returned non-OK response code of ${apiResponse.status}`)
})();
