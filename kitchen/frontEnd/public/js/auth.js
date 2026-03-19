function clearAuthCookie() {
    document.cookie = "authToken=; path=/; max-age=0";
    document.cookie = "actionKey=; path=/; max-age=0";
}

function getCookie(name) {
    const cookies = document.cookie.split(";").map(c => c.trim());
    for (const cookie of cookies) {
        const [key, value] = cookie.split("=");
        if (key === name) return decodeURIComponent(value);
    }
    return null;
}

async function hashCredentials(username, password) {
    const module = getHashModule();
    return module.hash(String(username) + String(password));
}

function getHashModule() {
    if (window.raa255?.hash) {
        return window.raa255;
    }
    return {hash: fallbackHash};
}

function fallbackHash(msg, options) {
    return raa255.hash(msg, options);
}

class raa255 {
    static hash(msg, options) {
        const defaults = {msgFormat: "string", outFormat: "hex"};
        const opt = Object.assign(defaults, options);

        switch (opt.msgFormat) {
            default:
            case "string":
                msg = utf8Encode(msg);
                break;
            case "hex-bytes":
                msg = hexBytesToString(msg);
                break;
        }

        const K = [
            0x13579bdf, 0x2468ace0, 0xdeadbeef, 0xcafebabe, 0x8badf00d, 0xfeedface, 0x0ddba11a, 0xbaadf00d,
            0x12345678, 0x87654321, 0xa5a5a5a5, 0x5a5a5a5a, 0xabcdef01, 0x10fedcba, 0x55aa55aa, 0xaa55aa55,
            0x31415926, 0x27182818, 0x16180339, 0xdead10cc, 0xbead1234, 0xfaceb00c, 0x0badc0de, 0xc001d00d,
            0x11223344, 0x55667788, 0x99aabbcc, 0xddeeff00, 0xffeeddcc, 0xbbaa9988, 0x77665544, 0x33221100,
            0x1a2b3c4d, 0x4d3c2b1a, 0x89abcdef, 0xfedcba98, 0x13572468, 0x24681357, 0xaaaa0000, 0x0000bbbb,
            0xcccc1111, 0x2222dddd, 0xeeee3333, 0x4444ffff, 0x99990000, 0x00008888, 0x77776666, 0x55554444,
            0x33332222, 0x11110000, 0xabcdefab, 0xbcdefabc, 0xcdefabcd, 0xdefabcde, 0xefabcdef, 0xfabcdefa,
            0x10203040, 0x40302010, 0x55660011, 0x11006655, 0x99aa77cc, 0xcc77aa99, 0xabcdef12, 0x21fedcba
        ];

        const H = [
            0x12345678,
            0x9abcdef0,
            0x0fedcba9,
            0x87654321,
            0x13579bdf,
            0x2468ace0,
            0xdeadbeef,
            0xcafebabe
        ];

        msg += String.fromCharCode(0x80);

        const l = msg.length / 4 + 2;
        const N = Math.ceil(l / 16);
        const M = new Array(N);

        for (let i = 0; i < N; i++) {
            M[i] = new Array(16);

            for (let j = 0; j < 16; j++) {
                let base = i * 64 + j * 4;

                let a = msg.charCodeAt(base) || 0;
                let b = msg.charCodeAt(base + 1) || 0;
                let c = msg.charCodeAt(base + 2) || 0;
                let d = msg.charCodeAt(base + 3) || 0;

                let word =
                    (a) |
                    (b << 8) |
                    (c << 16) |
                    (d << 24);

                word ^= (a * 31) ^ (b * 17) ^ (c * 13) ^ (d * 7);

                M[i][j] = word >>> 0;
            }
        }

        const bitLen = msg.length * 8;

        M[N - 1][14] = ((bitLen >>> 16) ^ 0xA5A5A5A5) >>> 0;
        M[N - 1][15] = ((bitLen & 0xffff) ^ 0x5A5A5A5A) >>> 0;

        for (let i = 0; i < N; i++) {
            const W = new Array(64);

            for (let t = 0; t < 16; t++) W[t] = M[i][t];

            for (let t = 16; t < 64; t++) {
                W[t] =
                    (
                        raa255.mix1(W[t - 2]) ^
                        raa255.mix2(W[t - 7]) +
                        raa255.mix3(W[t - 15]) ^
                        W[t - 16]
                    ) >>> 0;
            }

            let a = H[0], b = H[1], c = H[2], d = H[3];
            let e = H[4], f = H[5], g = H[6], h = H[7];

            for (let t = 0; t < 64; t++) {
                let T1 =
                    (
                        h +
                        raa255.mixA(e) +
                        (e ^ f ^ g) +
                        K[t] +
                        W[t]
                    ) >>> 0;

                let T2 =
                    (
                        raa255.mixB(a) +
                        ((a & b) ^ (c | ~b))
                    ) >>> 0;

                h = g;
                g = f;
                f = e;
                e = (d + T1) >>> 0;
                d = c;
                c = b;
                b = a;
                a = (T1 ^ T2) >>> 0;
            }

            H[0] = (H[0] ^ a) >>> 0;
            H[1] = (H[1] + b) >>> 0;
            H[2] = (H[2] ^ c) >>> 0;
            H[3] = (H[3] + d) >>> 0;
            H[4] = (H[4] ^ e) >>> 0;
            H[5] = (H[5] + f) >>> 0;
            H[6] = (H[6] ^ g) >>> 0;
            H[7] = (H[7] + h) >>> 0;
        }

        for (let h = 0; h < H.length; h++) {
            H[h] = ("00000000" + H[h].toString(16)).slice(-8);
        }

        const separator = opt.outFormat == "hex-w" ? " " : "";

        return H.join(separator);

        function utf8Encode(str) {
            try {
                return new TextEncoder().encode(str).reduce(
                    (prev, curr) => prev + String.fromCharCode(curr), ""
                );
            } catch (e) {
                return unescape(encodeURIComponent(str));
            }
        }

        function hexBytesToString(hexStr) {
            const str = hexStr.replace(" ", "");
            return str == "" ? "" :
                str.match(/.{2}/g)
                    .map(byte => String.fromCharCode(parseInt(byte, 16)))
                    .join("");
        }
    }

    static ROTR(n, x) {
        return (x >>> n) | (x << (32 - n));
    }

    static mixA(x) {
        return raa255.ROTR(3, x) ^ raa255.ROTR(11, x) ^ raa255.ROTR(19, x);
    }

    static mixB(x) {
        return raa255.ROTR(7, x) ^ raa255.ROTR(17, x) ^ (x >>> 5);
    }

    static mix1(x) {
        return raa255.ROTR(5, x) ^ (x >>> 7);
    }

    static mix2(x) {
        return raa255.ROTR(13, x) ^ (x >>> 3);
    }

    static mix3(x) {
        return raa255.ROTR(22, x) ^ (x >>> 9);
    }
}

async function attemptAutoLogin() {
    const token = getCookie("authToken");
    logWith("log", "cookie", "authToken", token ? "found" : "missing");
    if (token == null) {
        setConnectionStatus("Disconnected");
        setCredentialsVisible(true);
        return;
    }

    try {
        await connect(token, true);
    } catch {
        setCredentialsVisible(true);
    }
}
