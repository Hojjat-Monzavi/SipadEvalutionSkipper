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
   * Helper function to generate normally distributed numbers (Box-Muller transform)
   * - Clicks specific evaluation buttons on the first page of sipad.
   * - Selects specific radio buttons in a 2D format on the second page of sipad.
   * - clicks continue button.
   * @param {number} mean - mean of the PDF
   * @param {number} stdDev - standard deviation to apply
   */
  function getNormalRandom(mean, stdDev) {
    let u = 1 - Math.random();
    let v = Math.random();
    let z = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
    return z * stdDev + mean;
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
      btn.style.outline = "3px solid red";
    });
    console.log(`[SipadEvaluationSkipper] Found ${detailButtons.length} detail buttons`);
    if (detailButtons.length > 0) {
      detailButtons[0].click();
    }

    // Find continue button
    const continueButtons = querySelectorAllDeep('input[type="button"]#btnContinue.button[name="btnContinue"][value="ثبت"][onclick="onNewClick()"]', doc);
    if (continueButtons.length > 0) {
      continueButtons[0].style.outline = "3px solid blue";
      console.log("[SipadEvaluationSkipper] Continue button found and highlighted");
    } else {
      console.log("[SipadEvaluationSkipper] Continue button NOT found");
    }

    // Find radio buttons and build 2D array
    const radios = querySelectorAllDeep('input[type="radio"][id^="rb"]', doc);
    console.log(`[SipadEvaluationSkipper] Found ${radios.length} radio inputs`);

    const coords = [];
    radios.forEach(input => {
      try {
        // Ensure the input has the expected 'rb' id and 'foobar' name prefixes
        if (input.id && input.id.startsWith("rb") && input.name && input.name.startsWith("foobar")) {
          console.log(`[SipadEvaluationSkipper] Processing input element ID: ${input.id}`);

          // Extract strings
          const yStr = input.name.replace("foobar", "");
          const xyStr = input.id.replace("rb", "");

          // Verify the id string ends with the y string
          if (xyStr.endsWith(yStr)) {
            const xStr = xyStr.slice(0, -yStr.length);

            const x = parseInt(xStr, 10);
            const y = parseInt(yStr, 10);

            // Check that we successfully parsed valid numbers
            if (!isNaN(x) && !isNaN(y)) {
              coords.push({ x, y, input });
              input.style.outline = "2px solid green";
              console.log(`[SipadEvaluationSkipper] Successfully mapped coordinates -> x: ${x}, y: ${y}`);
            } else {
              console.warn(`[SipadEvaluationSkipper] Failed to parse integers. xStr: "${xStr}", yStr: "${yStr}"`, input);
            }
          } else {
            console.warn(`[SipadEvaluationSkipper] Mismatch: ID string "${xyStr}" does not end with Name string "${yStr}". Skipping.`, input);
          }
        }
      } catch (e) {
        // Catch any unexpected DOM errors, specifically cross-origin issues
        if (e.name === "SecurityError") {
          console.warn("[SipadEvaluationSkipper] Cannot access element/iframe due to cross-origin policy:", input, e);
        } else {
          console.error("[SipadEvaluationSkipper] An unexpected error occurred while processing input:", input, e);
        }
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

    // Select Randomly
    const numChoices = radioArray.length;
    const maxRowIndex = numChoices - 1;

    const targetMean = maxRowIndex * 0.75; //mean = 75% (15/20)

    const stdDeviation = maxRowIndex * 0.2; // cv=0.2

    // Select using Normal Distribution
    for (let i = 0; i < radioArray[0].length; i++) {

      let rawValue = getNormalRandom(targetMean, stdDeviation);
      let randomRow = Math.round(rawValue);

      // Clamp between 0 and the dynamic maxRowIndex
      randomRow = Math.max(0, Math.min(maxRowIndex, randomRow));

      radioArray[randomRow][i].checked = true;
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
    processAllFrames();
  } else {
    window.addEventListener("load", () => {
      console.log("[SipadEvaluationSkipper] Window load event fired, processing now...");
      processAllFrames();
    });
  }

  /**
   * Observes DOM changes and reprocesses all frames when mutations occur.
   */
  const observer = new MutationObserver((mutations) => {
    console.log("[SipadEvaluationSkipper] DOM mutations detected, reprocessing frames...");
    processAllFrames();
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true
  });

  console.log("[SipadEvaluationSkipper] MutationObserver initialized");

})();
