// content.js

(() => {
  console.log("[SipadEvaluationSkipper] Button Inspector script started");

  /**
   * Recursively queries all shadow roots within the DOM for elements matching the given selector.
   * @param {string} selector - CSS selector string.
   * @param {Document | ShadowRoot} [root=document] - Root to start search from.
   * @returns {Element[]} Array of matching elements from light DOM and all shadow roots.
   */
  function querySelectorAllDeep(selector, root = document) {
    let results = Array.from(root.querySelectorAll(selector));
    const allNodes = root.querySelectorAll('*');
    for (const node of allNodes) {
      if (node.shadowRoot) {
        results = results.concat(querySelectorAllDeep(selector, node.shadowRoot));
      }
    }
    return results;
  }

  /**
   * Processes the given document or frame:
   * - Clicks specific evaluation buttons on the first page of sipad.
   * - Selects specific radio buttons in a 2D format on the second page of sipad.
   * - clicks continue button.
   * @param {Document} doc - Document object to process.
   */
  function processDocument(doc) {
    if (!doc) return;

    console.log("[SipadEvaluationSkipper] Processing document:", doc.location ? doc.location.href : "main document");

    // Find detail buttons
    const detailButtons = querySelectorAllDeep('input[type="button"].detail[title="انجام ارزشیابی"]', doc)
      .filter(btn => btn.getAttribute("onclick") === "OnDetailClick(this);");
    detailButtons.forEach(btn => {
      // Intentionally left blank for future processing
    });
    console.log(`[SipadEvaluationSkipper] Found ${detailButtons.length} detail buttons`);
    if (detailButtons.length > 0) {
      detailButtons[0].click();
    }

    // Find continue button
    const continueButtons = querySelectorAllDeep('input[type="button"]#btnContinue.button[name="btnContinue"][value="ثبت"][onclick="onNewClick()"]', doc);
    if (continueButtons.length > 0) {
      console.log("[SipadEvaluationSkipper] Continue button found and highlighted");
    } else {
      console.log("[SipadEvaluationSkipper] Continue button NOT found");
    }

    // Find radio buttons and build 2D array
    const radios = querySelectorAllDeep('input[type="radio"][id^="rb"]', doc);
    console.log(`[SipadEvaluationSkipper] Found ${radios.length} radio inputs`);

    const coords = [];
    radios.forEach(input => {
      const m = input.id.match(/^rb(\d)(\d)$/);
      if (m) {
        const x = parseInt(m[1], 10);
        const y = parseInt(m[2], 10);
        coords.push({ x, y, input });
      }
    });

    if (coords.length === 0) {
      console.log("[SipadEvaluationSkipper] No radio buttons with proper id format found");
      return;
    }

    const maxX = Math.max(...coords.map(c => c.x));
    const maxY = Math.max(...coords.map(c => c.y));
    const radioArray = Array.from({ length: maxX + 1 }, () => Array(maxY + 1).fill(null));
    coords.forEach(({ x, y, input }) => {
      radioArray[x][y] = input;
    });

    // Select highest value in each column (row 4)
    for (let i = 0; i < radioArray[0].length; i++) {
      radioArray[4][i].checked = true;
    }

    console.log(`[SipadEvaluationSkipper] Constructed radio 2D array with dimensions [${maxX + 1}][${maxY + 1}]`);

    continueButtons[0].click();

  }

  /**
   * Recursively processes the root document and all accessible iframes within it.
   * @param {Document} [rootDoc=document] - Root document to begin processing.
   */
  function processAllFrames(rootDoc = document) {
    processDocument(rootDoc);

    const iframes = rootDoc.querySelectorAll('iframe');
    iframes.forEach(iframe => {
      try {
        const frameDoc = iframe.contentDocument || iframe.contentWindow.document;
        if (frameDoc) {
          processAllFrames(frameDoc);
        }
      } catch (e) {
        console.warn("[SipadEvaluationSkipper] Cannot access iframe due to cross-origin policy:", iframe, e);
      }
    });
  }

  // Load-time processing
  if (document.readyState === "complete") {
    console.log("[SipadEvaluationSkipper] Document readyState complete, processing now...");
    window.setInterval(processAllFrames, 300);
  } else {
    window.addEventListener("load", () => {
      console.log("[SipadEvaluationSkipper] Window load event fired, processing now...");
      window.setInterval(processAllFrames, 300);
    });
  }

  /**
   * Observes DOM changes and reprocesses all frames when mutations occur.
   */
  const observer = new MutationObserver((mutations) => {
    console.log("[SipadEvaluationSkipper] DOM mutations detected, reprocessing frames...");
    window.setInterval(processAllFrames, 300);
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true
  });

  console.log("[SipadEvaluationSkipper] MutationObserver initialized");

})();
