// bgImg is the background image to be modified.
// fgImg is the foreground image.
// fgOpac is the opacity of the foreground image.
// fgPos is the position of the foreground image in pixels. It can be negative and (0,0) means the top-left pixels of the foreground and background are aligned.
function composite( bgImg, fgImg, fgOpac, fgPos )
{
    let width = bgImg.width;
    let height = bgImg.height;
    let bgData = bgImg.data;
    let fgData = fgImg.data;

    for (let y = 0; y < fgImg.height; y++) {
        for (let x = 0; x < fgImg.width; x++) {
            let fgX = x + fgPos.x;
            let fgY = y + fgPos.y;

            if (fgX >= 0 && fgX < width && fgY >= 0 && fgY < height) {
                let bgIndex = (fgY * width + fgX) * 4;
                let fgIndex = (y * fgImg.width + x) * 4;

                let fgAlpha = fgData[fgIndex + 3] / 255 * fgOpac;
                let invAlpha = 1 - fgAlpha;
                
                // set the correct color (RGB) and opacity for the compositing of the two images
                bgData[bgIndex] = bgData[bgIndex] * invAlpha + fgData[fgIndex] * fgAlpha; 
                bgData[bgIndex + 1] = bgData[bgIndex + 1] * invAlpha + fgData[fgIndex + 1] * fgAlpha; 
                bgData[bgIndex + 2] = bgData[bgIndex + 2] * invAlpha + fgData[fgIndex + 2] * fgAlpha; 
                bgData[bgIndex + 3] = Math.min(255, bgData[bgIndex + 3] + fgAlpha * 255); 
            }
        }
    }
}