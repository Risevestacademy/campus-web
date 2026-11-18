// Written only by the root proxy, which overwrites any client-supplied value.
// The proxy also clears the refresh marker cookie on its response, and Next
// copies that deletion into cookies() for the render, so the render reads the
// marker's presence from this header instead.
export const RETURN_TO_HEADER = "x-campus-return-to";
export const REFRESH_ATTEMPTED_HEADER = "x-campus-refresh-attempted";
