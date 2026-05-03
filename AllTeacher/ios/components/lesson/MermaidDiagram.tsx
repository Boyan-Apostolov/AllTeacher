/**
 * Renders a Mermaid diagram inside a tightly-sized WebView.
 *
 * Why a WebView and not a React Native SVG renderer:
 *   - Mermaid's parser is a non-trivial JS module that targets the
 *     browser. Porting it to RN is several thousand lines of work.
 *   - The Explainer keeps diagrams small (≤ 8 nodes by prompt
 *     instruction), so the rendering cost is tiny — even on older
 *     phones the WebView round-trip is < 100 ms.
 *
 * Sizing:
 *   The HTML template measures the rendered SVG and posts the height
 *   back over `window.ReactNativeWebView.postMessage`. We listen on
 *   `onMessage` and adjust the View height accordingly so the diagram
 *   doesn't sit inside a sad 200-px scrollable iframe.
 *
 * Failure mode:
 *   `react-native-webview` is loaded with a try/catch require so this
 *   file still type-checks before `npm install` lands the package.
 *   When the dep is missing, the component renders a tiny "diagram
 *   unavailable" hint instead of crashing the screen.
 */
import { useMemo, useState } from "react";
import { Text, View } from "react-native";

import { lessonMermaidStyles as styles } from "./MermaidDiagram.styles";

// Lazy-load the WebView so the file imports cleanly before the
// package is installed. Both shapes are common in the wild —
// `WebView` as default OR named export depending on RN-W version.
let _WebView: any = null;
try {
  const mod = require("react-native-webview");
  _WebView = mod?.WebView || mod?.default || null;
} catch {
  _WebView = null;
}

// Build the inline HTML doc the WebView renders. We pin a specific
// mermaid version (10.x is the latest with the post-v8 syntax the
// Explainer prompt teaches) so a CDN auto-bump can't silently break
// rendering for users with cached webviews.
function buildHtml(source: string): string {
  // Escape the source for embedding inside a <pre>: HTML entity-encode
  // angle brackets and backticks. We do NOT escape quotes — Mermaid
  // labels routinely use them.
  const escaped = source
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
<style>
  html, body {
    margin: 0;
    padding: 0;
    background: transparent;
    font-family: -apple-system, system-ui, sans-serif;
    color: #1d1640;
  }
  body { padding: 0; }
  /* Mermaid renders into this container; we centre and constrain it. */
  #diagram {
    display: flex;
    justify-content: center;
    overflow-x: auto;
    padding: 0;
  }
  #diagram svg { max-width: 100%; height: auto !important; }
  #err {
    color: #ef4444;
    font-size: 12px;
    padding: 12px;
    text-align: center;
  }
</style>
</head>
<body>
<div id="diagram"></div>
<div id="err" style="display:none"></div>
<script src="https://cdnjs.cloudflare.com/ajax/libs/mermaid/10.9.1/mermaid.min.js"></script>
<script>
  (function () {
    function postHeight() {
      try {
        var h = Math.max(
          document.documentElement.scrollHeight,
          document.body.scrollHeight
        );
        if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'mermaid:height',
            height: h
          }));
        }
      } catch (e) { /* noop */ }
    }
    function showError() {
      // Hide the diagram container and post a minimal height so the
      // lesson card collapses cleanly — no red bomb or parse errors shown.
      document.getElementById('diagram').style.display = 'none';
      if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
        window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'mermaid:error' }));
      }
    }
    try {
      mermaid.initialize({
        startOnLoad: false,
        securityLevel: 'loose',
        theme: 'default',
        suppressErrorRendering: true,
        flowchart: { useMaxWidth: true },
        themeVariables: {
          primaryColor: '#FBF4E6',
          primaryTextColor: '#1A1410',
          primaryBorderColor: '#1A1410',
          lineColor: '#FF6B3D',
          fontSize: '14px'
        }
      });
      var src = ${'`' + escaped + '`'};
      mermaid.render('rendered', src).then(function (out) {
        document.getElementById('diagram').innerHTML = out.svg;
        postHeight();
        setTimeout(postHeight, 60);
      }).catch(function (e) {
        showError();
      });
    } catch (e) {
      showError();
    }
  })();
</script>
</body>
</html>`;
}

export function MermaidDiagram({ source }: { source: string }) {
  const html = useMemo(() => buildHtml(source), [source]);
  // Start with a sensible default height; the WebView will post its
  // measured height once the SVG has rendered and we'll grow into it.
  const [height, setHeight] = useState(160);

  if (!_WebView) {
    // Don't crash the lesson screen if the dep isn't installed yet.
    // The lesson still has its text content; this just falls back to
    // a small notice. Production builds always have the dep.
    return (
      <View style={styles.fallback}>
        <Text style={styles.fallbackText}>
          Diagram needs the WebView dependency — run `npm install` in /ios.
        </Text>
      </View>
    );
  }

  if (height === 0) return null;
  return (
    <View style={[styles.container, { height }]}>
      <_WebView
        originWhitelist={["*"]}
        source={{ html }}
        scalesPageToFit={false}
        scrollEnabled={false}
        showsHorizontalScrollIndicator={false}
        showsVerticalScrollIndicator={false}
        // Background transparent so the WebView blends into the
        // surrounding lesson card (Mermaid's body bg is also
        // transparent — see buildHtml).
        style={styles.webview}
        // iOS / Android both honour these:
        opaque={false}
        backgroundColor={"transparent"}
        // Resize to whatever the rendered SVG measures.
        onMessage={(event: any) => {
          try {
            const data = JSON.parse(event?.nativeEvent?.data ?? "{}");
            if (data?.type === "mermaid:height" && typeof data.height === "number") {
              const next = Math.max(80, Math.min(600, Math.ceil(data.height)));
              setHeight(next);
            } else if (data?.type === "mermaid:error") {
              setHeight(0);   // collapse the View — diagram unavailable
            }
          } catch {
            /* ignore */
          }
        }}
      />
    </View>
  );
}

export default MermaidDiagram;
