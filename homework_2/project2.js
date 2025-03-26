// Returns a 3x3 transformation matrix as an array of 9 values in column-major order.
// The transformation first applies scale, then rotation, and finally translation.
// The given rotation value is in degrees.
function GetTransform( positionX, positionY, rotation, scale )
{
	let rotation_rad = (rotation * Math.PI)/180;
	let s_mtx = Array(scale, 0, 0, 0, scale, 0, 0, 0, 1);
	let r_mtx = Array(Math.cos(rotation_rad), Math.sin(rotation_rad), 0, -Math.sin(rotation_rad), Math.cos(rotation_rad), 0, 0, 0, 1);
	let t_mtx = Array(1, 0, 0, 0, 1, 0, positionX, positionY, 1);
	
	res = multiplyMatrices(t_mtx, multiplyMatrices(r_mtx, s_mtx));

	return res;
}

// Returns a 3x3 transformation matrix as an array of 9 values in column-major order.
// The arguments are transformation matrices in the same format.
// The returned transformation first applies trans1 and then trans2.
function ApplyTransform( trans1, trans2 )
{
	return multiplyMatrices(trans2, trans1);
}


function multiplyMatrices(a, b) {
    let result = new Array(9).fill(0);
    
    for (let i = 0; i < 3; i++) {  // Riga di A
        for (let j = 0; j < 3; j++) {  // Colonna di B
            for (let k = 0; k < 3; k++) {  // Elementi per la somma
                result[j * 3 + i] += a[k * 3 + i] * b[j * 3 + k];
            }
        }
    }
    
    return result;
}