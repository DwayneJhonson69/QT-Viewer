/**
 * src/SpineCharacter.js
 * Framework-agnostic interactive Spine character component for Aeon's Echo.
 * Uses Spine WebGL / SpinePlayer 4.1.x runtime.
 */

export class SpineCharacter {
  /**
   * Factory method to create and initialize a SpineCharacter instance.
   * @param {HTMLElement} containerEl - DOM container element
   * @param {Object} options - Configuration options
   * @returns {Promise<SpineCharacter>}
   */
  static async create(containerEl, options = {}) {
    const instance = new SpineCharacter(containerEl, options);
    await instance._init();
    return instance;
  }

  constructor(containerEl, options = {}) {
    if (!containerEl) {
      throw new Error("SpineCharacter: containerEl is required.");
    }

    this.container = containerEl;
    this.options = {
      basePath: options.basePath || "",
      skeleton: options.skeleton || "skeleton.skel",
      atlas: options.atlas || "skeleton.atlas",
      idle: options.idle !== undefined ? options.idle : "idle",
      blink: options.blink || null,
      envLoops: options.envLoops || [],
      premultipliedAlpha: options.premultipliedAlpha !== undefined ? options.premultipliedAlpha : true,
      mix: options.mix !== undefined ? options.mix : 0.25,
      viewport: options.viewport || null,
      speed: options.speed || 1,
      ...options
    };

    this.player = null;
    this.canvas = null;
    this.currentIdle = this.options.idle;
    this.isPlayingOneShot = false;
    this.isDestroyed = false;
    this.currentSkin = options.skin !== undefined ? options.skin : (options.defaultSkin || "default");
    this.speed = this.options.speed;
    this.blinkTimer = null;
    this.activeSequence = null;

    this._onVisibilityChange = this._onVisibilityChange.bind(this);
    this._onCanvasClick = this._onCanvasClick.bind(this);
  }

  async _init() {
    try {
      if (typeof window === "undefined" || !window.spine) {
        throw new Error("Spine runtime (spine-player 4.1.x) is not loaded on window.");
      }

      // Normalize base path
      let basePath = this.options.basePath;
      if (basePath && !basePath.endsWith("/")) {
        basePath += "/";
      }

      const skelUrl = basePath + this.options.skeleton;
      const atlasUrl = basePath + this.options.atlas;
      const isJsonSkeleton = this.options.isJson || skelUrl.toLowerCase().endsWith(".json");

      // Wrapper container setup
      this.wrapper = document.createElement("div");
      this.wrapper.className = "spine-character-wrapper";
      this.wrapper.style.width = "100%";
      this.wrapper.style.height = "100%";
      this.wrapper.style.position = "relative";
      this.wrapper.style.overflow = "hidden";
      this.container.appendChild(this.wrapper);

      return new Promise((resolve, reject) => {
        let isResolved = false;

        const playerConfig = {
          atlasUrl: atlasUrl,
          premultipliedAlpha: this.options.premultipliedAlpha,
          backgroundColor: "#00000000",
          alpha: true,
          showControls: false,
          showLoading: false,
          viewport: this.options.viewport,
          defaultMix: this.options.mix,
          rawDataURIs: this.options.rawDataURIs || undefined,
          success: (p) => {
            if (this.isDestroyed) {
              p.dispose();
              return;
            }

            this.canvas = this.wrapper.querySelector("canvas");

            // Apply defaultMix to track crossfades
            if (p.animationState && p.animationState.data) {
              p.animationState.data.defaultMix = this.options.mix;
            }

            // Ensure initial skin is explicitly synchronized to slots
            if (p.skeleton && this.currentSkin) {
              try {
                p.skeleton.setSkinByName(this.currentSkin);
                p.skeleton.setSlotsToSetupPose();
              } catch (e) {
                console.warn(`SpineCharacter: Initial skin '${this.currentSkin}' fallback:`, e.message);
              }
            }

            // Start parallel environmental loops on tracks 2, 3, 4...
            if (Array.isArray(this.options.envLoops) && p.animationState) {
              this.options.envLoops.forEach((envName, idx) => {
                try {
                  p.animationState.setAnimation(2 + idx, envName, true);
                } catch (e) {
                  console.warn(`SpineCharacter: Env loop '${envName}' failed:`, e.message);
                }
              });
            }

            // Natural periodic blinking on Track 1 (not continuous strobing)
            if (this.options.blink) {
              this.startBlinking(this.options.blink);
            }

            // Apply initial speed
            if (this.speed !== 1) {
              this.setSpeed(this.speed);
            }

            // Setup in-game 16:9 framing
            if (p.skeleton) {
              this._setupInGameFraming();
            }

            // Set up click reaction
            if (this.canvas) {
              this.canvas.style.cursor = "pointer";
              this.canvas.addEventListener("click", this._onCanvasClick);
            }

            // Pause when page tab is hidden
            document.addEventListener("visibilitychange", this._onVisibilityChange);

            // Sync currentIdle if auto-selected by SpinePlayer
            if (!this.currentIdle && p.skeleton && p.skeleton.data && p.skeleton.data.animations.length > 0) {
              this.currentIdle = p.config.animation || p.skeleton.data.animations[0].name;
            }

            // Ensure playback begins
            p.play();

            if (!isResolved) {
              isResolved = true;
              resolve(this);
            }
          },
          error: (p, msg) => {
            console.error(`SpineCharacter [${this.options.basePath}] load error:`, msg);
            this._showPlaceholder(msg);
            if (!isResolved) {
              isResolved = true;
              resolve(this); // Graceful recovery without crashing caller
            }
          }
        };
        if (this.options.idle) {
          playerConfig.animation = this.options.idle;
        }
        if (this.currentSkin) {
          playerConfig.skin = this.currentSkin;
        }
        if (isJsonSkeleton) {
          playerConfig.jsonUrl = skelUrl;
        } else {
          playerConfig.skelUrl = skelUrl;
        }
        this.player = new window.spine.SpinePlayer(this.wrapper, playerConfig);
      });
    } catch (err) {
      console.error(`SpineCharacter [${this.options.basePath}] init failed:`, err);
      this._showPlaceholder(err.message);
      return this;
    }
  }

  _showPlaceholder(errorText) {
    if (!this.wrapper) return;
    this.wrapper.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:center;width:100%;height:100%;background:rgba(20,20,30,0.8);color:#ff6b6b;font-family:sans-serif;font-size:14px;padding:16px;text-align:center;border-radius:8px;border:1px dashed #ff6b6b;">
        <div>
          <div style="font-size:24px;margin-bottom:8px;">⚠️</div>
          <b>Character Load Error</b><br>
          <span style="font-size:12px;color:#aaa;">${this.options.basePath}</span><br>
          <small style="color:#ff8e8e;margin-top:6px;display:inline-block;">${errorText || "Unknown error"}</small>
        </div>
      </div>
    `;
  }

  /**
   * Natural periodic blinking: plays blink once, waits 2.5s-5.5s, repeats.
   * Prevents non-stop eye strobing/spasms.
   */
  startBlinking(blinkAnimName) {
    this.stopBlinking();
    if (!blinkAnimName) return;
    this.blinkName = blinkAnimName;

    const scheduleNext = () => {
      // Fixed 1.5 second duration between eye blinks as requested
      const delay = 1500;
      this.blinkTimer = setTimeout(() => {
        if (this.isDestroyed || !this.player || !this.player.animationState) return;
        if (!this.player.paused) {
          try {
            const entry = this.player.animationState.setAnimation(1, this.blinkName, false);
            if (entry) {
              const onDone = () => {
                if (this.player && this.player.animationState) {
                  try { this.player.animationState.clearTrack(1); } catch (e) {}
                }
                scheduleNext();
              };
              entry.listener = { complete: onDone, end: onDone };
            } else {
              scheduleNext();
            }
          } catch (e) {
            scheduleNext();
          }
        } else {
          scheduleNext();
        }
      }, delay);
    };

    scheduleNext();
  }

  stopBlinking() {
    if (this.blinkTimer) {
      clearTimeout(this.blinkTimer);
      this.blinkTimer = null;
    }
    if (this.player && this.player.animationState) {
      try {
        this.player.animationState.clearTrack(1);
      } catch (e) {}
    }
  }

  /**
   * Plays a one-shot reaction on track 0, then auto-crossfades back to the current idle loop (or active sequence).
   * Preserves parallel environmental loops on higher tracks.
   * @param {string} name - Animation name (e.g. 'actionA_emo1', 'touch')
   */
  play(name) {
    if (!this.player || !this.player.animationState) return;
    if (this.isPlayingOneShot) return; // Prevent interrupting active one-shot

    try {
      this.isPlayingOneShot = true;
      const state = this.player.animationState;
      const returnAnim = this.activeSequence || this.currentIdle;
      const entry = state.setAnimation(0, name, false);
      state.addAnimation(0, returnAnim, true, 0);

      if (entry) {
        const onEnd = () => {
          this.isPlayingOneShot = false;
        };
        entry.listener = { complete: onEnd, end: onEnd };
      } else {
        this.isPlayingOneShot = false;
      }
    } catch (e) {
      console.warn(`SpineCharacter: Play '${name}' failed:`, e.message);
      this.isPlayingOneShot = false;
    }
  }

  /**
   * Starts a stateful sequence: plays ${baseName}_in (non-looping), then loops ${baseName}.
   * If another sequence was active, exits it with ${prev}_out first.
   * @param {string} baseName - Base name of the sequence (e.g. 'action_flirty1')
   */
  startSequence(baseName) {
    if (!this.player || !this.player.animationState) return;
    const state = this.player.animationState;
    const inAnim = `${baseName}_in`;
    const loopAnim = baseName;

    if (this.activeSequence && this.activeSequence !== baseName) {
      const prevOut = `${this.activeSequence}_out`;
      if (this.hasAnimation(prevOut)) {
        state.setAnimation(0, prevOut, false);
        if (this.hasAnimation(inAnim)) {
          state.addAnimation(0, inAnim, false, 0);
        }
      } else if (this.hasAnimation(inAnim)) {
        state.setAnimation(0, inAnim, false);
      }
    } else {
      if (this.hasAnimation(inAnim)) {
        state.setAnimation(0, inAnim, false);
      }
    }

    state.addAnimation(0, loopAnim, true, 0);
    this.activeSequence = baseName;
  }

  /**
   * Stops the active sequence: plays ${activeSequence}_out (non-looping), then returns to idle.
   */
  stopSequence() {
    if (!this.activeSequence || !this.player || !this.player.animationState) return;
    const state = this.player.animationState;
    const outAnim = `${this.activeSequence}_out`;
    this.activeSequence = null;

    if (this.hasAnimation(outAnim)) {
      state.setAnimation(0, outAnim, false);
      state.addAnimation(0, this.currentIdle, true, 0);
    } else {
      state.setAnimation(0, this.currentIdle, true);
    }
  }

  /**
   * Toggles a stateful sequence on or off.
   * @param {string} baseName
   * @returns {boolean} true if now active, false if stopped
   */
  toggleSequence(baseName) {
    if (this.activeSequence === baseName) {
      this.stopSequence();
      return false;
    } else {
      this.startSequence(baseName);
      return true;
    }
  }

  /**
   * Switches the base loop animation on track 0 with a crossfade.
   * @param {string} name - Animation name (e.g. 'idle', 'loop_a')
   */
  loop(name) {
    if (!this.player) return;
    this.currentIdle = name;
    try {
      if (this.player.setAnimation) {
        this.player.setAnimation(name, true);
      } else if (this.player.animationState) {
        this.player.animationState.setAnimation(0, name, true);
      }
    } catch (e) {
      console.warn(`SpineCharacter: Loop '${name}' failed:`, e.message);
    }
  }

  /**
   * Sets the active skin/costume and updates slot setup poses in real time.
   * @param {string} skinName - Skin name (e.g. 'A1', 'A2', 'ghost', 'man', 'default')
   */
  setSkin(skinName) {
    if (!this.player || !this.player.skeleton) return;
    this.currentSkin = skinName;
    try {
      this.player.config.skin = skinName;
      this.player.skeleton.setSkinByName(skinName);
      this.player.skeleton.setSlotsToSetupPose();
    } catch (e) {
      console.warn(`SpineCharacter: SetSkin '${skinName}' failed:`, e.message);
    }
  }

  /**
   * Toggles an environmental loop track on or off.
   * @param {string} name - Environmental loop animation name
   * @param {boolean} enabled - Whether to play or clear
   */
  setEnvLoop(name, enabled) {
    if (!this.player || !this.player.animationState) return;
    const idx = (this.options.envLoops || []).indexOf(name);
    if (idx === -1) return;
    const track = 2 + idx;
    if (enabled) {
      this.player.animationState.setAnimation(track, name, true);
    } else {
      this.player.animationState.clearTrack(track);
    }
  }

  /**
   * Single start / stop toggle. Returns true if now playing, false if paused.
   */
  togglePlay() {
    if (!this.player) return false;
    if (this.player.paused) {
      this.resume();
      return true;
    } else {
      this.pause();
      return false;
    }
  }

  /**
   * Adjusts playback speed (timeScale).
   * @param {number} factor - Speed multiplier (0.5, 1.0, 1.5, 2.0, etc.)
   */
  setSpeed(factor) {
    this.speed = factor;
    if (this.player) {
      this.player.speed = factor;
      if (this.player.animationState) {
        this.player.animationState.timeScale = factor;
      }
    }
  }

  /**
   * Pauses animation playback.
   */
  pause() {
    if (this.player && this.player.pause) {
      this.player.pause();
    }
  }

  /**
   * Resumes animation playback.
   */
  resume() {
    if (this.player && this.player.play) {
      this.player.play();
    }
  }

  _onVisibilityChange() {
    if (document.hidden) {
      this.pause();
    } else {
      this.resume();
    }
  }

  _onCanvasClick(e) {
    if (this.isPlayingOneShot) return;
    // Check if 'touch' animation exists
    const anims = this.getAnimations();
    const touchAnim = anims.find(a => a.toLowerCase() === "touch");
    if (touchAnim) {
      this.play(touchAnim);
      return;
    }
    // Check for interactive expressions (actionA_emo1, etc.)
    const reaction = anims.find(a => a.startsWith("action") || a.includes("emo") || a.includes("click") || a.includes("hit") || a.includes("encounter"));
    if (reaction) {
      this.play(reaction);
    }
  }

  /**
   * Sets native WebGL camera zoom factor without CSS raster scaling.
   * @param {number} zoom - Zoom multiplier (e.g. 1.0 to 4.0)
   */
  _setupInGameFraming() {
    if (!this.player || !this.player.skeleton) return;
    const p = this.player;
    const sk = p.skeleton;
    sk.updateWorldTransform();

    // Compute bounding box using only visible elements (alpha >= 0.05).
    // This ignores hidden parked assets (intro heads, offscreen props) that skew bounds.
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    let visibleCount = 0;
    const tempVertices = new Float32Array(1000);

    if (sk.drawOrder && window.spine) {
      for (let i = 0; i < sk.drawOrder.length; i++) {
        try {
          const slot = sk.drawOrder[i];
          if (!slot || !slot.bone || !slot.bone.active) continue;
          if (slot.color && slot.color.a < 0.05) continue;
          const att = slot.getAttachment();
          if (!att) continue;
          if (window.spine.RegionAttachment && att instanceof window.spine.RegionAttachment) {
            att.computeWorldVertices(slot, tempVertices, 0, 2);
            for (let v = 0; v < 8; v += 2) {
              const x = tempVertices[v], y = tempVertices[v + 1];
              if (x < minX) minX = x;
              if (x > maxX) maxX = x;
              if (y < minY) minY = y;
              if (y > maxY) maxY = y;
            }
            visibleCount++;
          } else if (window.spine.MeshAttachment && att instanceof window.spine.MeshAttachment) {
            const numVertices = att.worldVerticesLength;
            const verts = tempVertices.length >= numVertices ? tempVertices : new Float32Array(numVertices);
            att.computeWorldVertices(slot, 0, numVertices, verts, 0, 2);
            for (let v = 0; v < numVertices; v += 2) {
              const x = verts[v], y = verts[v + 1];
              if (x < minX) minX = x;
              if (x > maxX) maxX = x;
              if (y < minY) minY = y;
              if (y > maxY) maxY = y;
            }
            visibleCount++;
          }
        } catch (e) {
          // Ignore individual attachment calculation errors
        }
      }
    }

    let bWidth, bHeight, bMinX, bMinY;
    if (visibleCount > 0 && isFinite(minX) && isFinite(minY)) {
      bWidth = maxX - minX;
      bHeight = maxY - minY;
      bMinX = minX;
      bMinY = minY;
    } else {
      const offset = new window.spine.Vector2();
      const size = new window.spine.Vector2();
      sk.getBounds(offset, size, []);
      bWidth = size.x;
      bHeight = size.y;
      bMinX = offset.x;
      bMinY = offset.y;
    }

    const canvas = this.canvas || p.canvas;
    const canvasW = (canvas && canvas.clientWidth) ? canvas.clientWidth : 1200;
    const canvasH = (canvas && canvas.clientHeight) ? canvas.clientHeight : 720;
    const canvasAR = canvasW / canvasH;

    const isStanding = bHeight > bWidth * 0.95;
    let targetH, targetW, targetY, targetX;

    if (isStanding) {
      // Standing character: frame body & head naturally in view
      targetH = bHeight * 0.88;
      targetW = targetH * canvasAR;
      targetY = bMinY + bHeight * 0.08;
      targetX = (bMinX + bWidth / 2) - targetW / 2;
    } else {
      // Horizontal / CG / Bed / Play pose
      targetH = Math.max(bHeight * 1.05, bWidth / canvasAR);
      targetW = targetH * canvasAR;
      targetY = (bMinY + bHeight / 2) - targetH / 2;
      targetX = (bMinX + bWidth / 2) - targetW / 2;
    }

    if (p.currentViewport) {
      p.currentViewport.padLeft = 0;
      p.currentViewport.padRight = 0;
      p.currentViewport.padTop = 0;
      p.currentViewport.padBottom = 0;
    }

    this.baseViewport = {
      x: targetX,
      y: targetY,
      width: targetW,
      height: targetH,
      padLeft: 0,
      padRight: 0,
      padTop: 0,
      padBottom: 0
    };
    this.inGameRect = Object.assign({}, this.baseViewport);
    this.resetCamera();
  }

  setZoom(zoom) {
    if (!this.player || !this.player.currentViewport) return;
    if (!this.baseViewport) {
      this.baseViewport = Object.assign({}, this.player.currentViewport);
    }
    // Min zoom 0.5x, max zoom 4.5x
    this.currentZoom = Math.min(Math.max(zoom, 0.5), 4.5);
    this._updateCamera();
  }

  /**
   * Pans the native WebGL camera by world units.
   * @param {number} dx - Horizontal pan offset in Spine units
   * @param {number} dy - Vertical pan offset in Spine units
   */
  pan(dx, dy) {
    if (!this.player || !this.player.currentViewport) return;
    this.panX = (this.panX || 0) + dx;
    this.panY = (this.panY || 0) + dy;
    this._updateCamera();
  }

  /**
   * Resets camera zoom and pan to 100% default pose.
   */
  resetCamera() {
    this.currentZoom = 1.0;
    this.panX = 0;
    this.panY = 0;
    if (this.baseViewport && this.player && this.player.currentViewport) {
      Object.assign(this.player.currentViewport, this.baseViewport);
      if (this.onCameraUpdate) {
        this.onCameraUpdate(1.0, 0, 0);
      }
    }
  }

  _updateCamera() {
    if (!this.player || !this.player.currentViewport || !this.baseViewport) return;
    const zoom = this.currentZoom || 1.0;
    const px = this.panX || 0;
    const py = this.panY || 0;
    const bv = this.baseViewport;

    this.player.currentViewport.width = bv.width / zoom;
    this.player.currentViewport.height = bv.height / zoom;
    this.player.currentViewport.x = (bv.x + bv.width / 2) - (bv.width / zoom) / 2 - px;
    this.player.currentViewport.y = (bv.y + bv.height / 2) - (bv.height / zoom) / 2 + py;

    if (this.onCameraUpdate) {
      this.onCameraUpdate(zoom, px, py);
    }
  }

  /**
   * Returns list of available animation names.
   */
  getAnimations() {
    if (!this.player || !this.player.skeleton || !this.player.skeleton.data) return [];
    return this.player.skeleton.data.animations.map(a => a.name);
  }

  /**
   * Checks if an animation exists.
   */
  hasAnimation(name) {
    return this.getAnimations().includes(name);
  }

  /**
   * Destroys the component, disposing WebGL resources and event listeners.
   */
  destroy() {
    this.isDestroyed = true;
    this.stopBlinking();
    document.removeEventListener("visibilitychange", this._onVisibilityChange);
    if (this.canvas) {
      this.canvas.removeEventListener("click", this._onCanvasClick);
    }
    if (this.player && this.player.dispose) {
      try {
        this.player.dispose();
      } catch (e) {}
      this.player = null;
    }
    if (this.wrapper && this.wrapper.parentNode) {
      this.wrapper.parentNode.removeChild(this.wrapper);
    }
  }
}
