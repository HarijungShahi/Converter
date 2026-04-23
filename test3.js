const fs = require('fs');
const path = require('path');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegInstaller = require('@ffmpeg-installer/ffmpeg');
ffmpeg.setFfmpegPath(ffmpegInstaller.path);

async function testAudioVideo() {
    const mp3Path = path.join(__dirname, 'test.mp3');
    const mp4Path = path.join(__dirname, 'test.mp4');
    
    // Create a 1s mp3
    await new Promise((resolve, reject) => {
        ffmpeg()
            .input('anullsrc')
            .inputFormat('lavfi')
            .duration(1)
            .output(mp3Path)
            .on('end', resolve)
            .on('error', reject)
            .run();
    });
    console.log("Created dummy mp3");

    // Convert mp3 to mp4
    try {
        await new Promise((resolve, reject) => {
            ffmpeg(mp3Path)
                .output(mp4Path)
                .on('end', resolve)
                .on('error', reject)
                .run();
        });
        console.log("Success mp3 to mp4");
    } catch (e) {
        console.error("Failed mp3 to mp4", e);
    }
}

testAudioVideo();
