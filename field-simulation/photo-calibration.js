// Ground-level wall edges traced on the source photo (1200 x 896 coordinates).
// They are the two red perimeter guides in the user's reference image.
export const PARKING_PERIMETER=Object.freeze({corner:[571,6],left:[390,105],right:[700,60]});
const {corner,left,right}=PARKING_PERIMETER;
export const PERIMETER_FORWARD=[right[0]-corner[0],right[1]-corner[1]];
export const PERIMETER_ROW=[left[0]-corner[0],left[1]-corner[1]];
const forwardSlope=PERIMETER_FORWARD[1]/PERIMETER_FORWARD[0];
const rowSlope=PERIMETER_ROW[1]/PERIMETER_ROW[0];
// Orthogonal ground axes in an orthographic photo obey m1*m2=-sin(elevation)^2.
// Calibrate the whole photo/world transform, so both painted axes AND the
// rigid loader match the same wall directions without a skewed fake rectangle.
const sineElevation=Math.sqrt(-forwardSlope*rowSlope);
export const PHOTO_PROJECTION=Object.freeze({elevation:Math.asin(sineElevation),yaw:Math.atan(forwardSlope/sineElevation)});
