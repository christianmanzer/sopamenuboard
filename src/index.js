// Menu board Worker.
//   /<location>/menu/<screen>   -> the player page (one URL per TV)
//   everything else             -> static files in /public (playlist, images, fonts)
// To add a restaurant: add public/<location>/playlist.json and point a TV at
// /<location>/menu/1. No code changes needed.

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (/^\/[a-z0-9-]+\/menu\/[a-z0-9-]+\/?$/i.test(url.pathname)) {
      const page = await env.ASSETS.fetch(new URL("/player.html", url));
      const res = new Response(page.body, page);
      res.headers.set("Cache-Control", "no-cache");
      return res;
    }

    const res = await env.ASSETS.fetch(request);
    if (url.pathname.endsWith("playlist.json") || url.pathname === "/sw.js") {
      const r = new Response(res.body, res);
      r.headers.set("Cache-Control", "no-cache");
      return r;
    }
    return res;
  },
};
