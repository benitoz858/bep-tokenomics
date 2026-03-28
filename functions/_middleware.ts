// Cloudflare Pages middleware — password gate for /tokenomics only
// Home page (/) is public. Set password via SITE_PASSWORD env var.

const LOGIN_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>The Stack | BEP Research</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background: #050505;
      color: #f0f0f0;
      font-family: 'Inter', -apple-system, sans-serif;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .container {
      max-width: 400px;
      width: 100%;
      padding: 40px;
    }
    .brand {
      font-family: Georgia, serif;
      font-size: 28px;
      font-weight: 900;
      margin-bottom: 4px;
    }
    .sub {
      font-family: monospace;
      font-size: 11px;
      color: #666;
      letter-spacing: 2px;
      margin-bottom: 32px;
    }
    .desc {
      font-size: 13px;
      color: #999;
      line-height: 1.6;
      margin-bottom: 24px;
    }
    form { display: flex; flex-direction: column; gap: 12px; }
    input[type="password"] {
      background: #0a0a0a;
      border: 1px solid #1a1a1a;
      border-radius: 6px;
      padding: 12px 16px;
      color: #f0f0f0;
      font-family: monospace;
      font-size: 14px;
      outline: none;
      transition: border-color 0.2s;
    }
    input[type="password"]:focus { border-color: #76B900; }
    button {
      background: #76B900;
      color: #050505;
      border: none;
      border-radius: 6px;
      padding: 12px;
      font-weight: 700;
      font-size: 14px;
      cursor: pointer;
      transition: opacity 0.2s;
    }
    button:hover { opacity: 0.9; }
    .error {
      color: #FF4444;
      font-size: 12px;
      font-family: monospace;
      text-align: center;
    }
    .back {
      text-align: center;
      margin-top: 16px;
    }
    .back a {
      color: #666;
      font-size: 11px;
      font-family: monospace;
      text-decoration: none;
    }
    .back a:hover { color: #999; }
    .footer {
      text-align: center;
      margin-top: 32px;
      font-size: 9px;
      font-family: monospace;
      color: rgba(102,102,102,0.4);
      letter-spacing: 2px;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="brand">The Stack</div>
    <div class="sub">BEP RESEARCH</div>
    <div class="desc">
      Live AI infrastructure data — token pricing, GPU economics, inference margins, cluster TCO. Enter your subscriber access code.
    </div>
    <form method="POST" action="/tokenomics/__auth">
      <input type="password" name="password" placeholder="Access code" autocomplete="off" autofocus required />
      <button type="submit">Enter</button>
      ERRORMSG
    </form>
    <div class="back"><a href="/">← bepresearch.com</a></div>
    <div class="footer">BEP RESEARCH © 2026</div>
  </div>
</body>
</html>`;

interface Env {
  SITE_PASSWORD: string;
}

export const onRequest: PagesFunction<Env> = async (context) => {
  const { request, env, next } = context;
  const url = new URL(request.url);
  const password = env.SITE_PASSWORD || "bepresearch2026";

  // Only gate /tokenomics paths — let everything else through
  if (!url.pathname.startsWith("/tokenomics")) {
    return next();
  }

  // Handle login form submission
  if (url.pathname === "/tokenomics/__auth" && request.method === "POST") {
    const formData = await request.formData();
    const submitted = formData.get("password") as string;

    if (submitted === password) {
      return new Response(null, {
        status: 302,
        headers: {
          Location: "/tokenomics",
          "Set-Cookie": `bep_auth=${btoa(password)}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=2592000`,
        },
      });
    }

    const html = LOGIN_HTML.replace("ERRORMSG", '<div class="error">Invalid access code</div>');
    return new Response(html, { status: 401, headers: { "Content-Type": "text/html" } });
  }

  // Handle logout
  if (url.pathname === "/tokenomics/__logout") {
    return new Response(null, {
      status: 302,
      headers: {
        Location: "/",
        "Set-Cookie": "bep_auth=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0",
      },
    });
  }

  // Check auth cookie
  const cookie = request.headers.get("Cookie") || "";
  const authMatch = cookie.match(/bep_auth=([^;]+)/);

  if (authMatch) {
    try {
      if (atob(authMatch[1]) === password) {
        return next();
      }
    } catch {
      // Invalid cookie
    }
  }

  // Not authenticated — show login
  const html = LOGIN_HTML.replace("ERRORMSG", "");
  return new Response(html, { status: 401, headers: { "Content-Type": "text/html" } });
};
