import { createHash } from "node:crypto";
import { createReadStream, createWriteStream } from "node:fs";
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
