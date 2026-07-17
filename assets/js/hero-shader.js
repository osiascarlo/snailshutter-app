/**
 * SnailShutter Futuristic WebGL Hero Shader
 * Zero dependencies, native WebGL, interactive lens distortion,
 * Snail-Shutter spiral aperture, floating bokeh, and digital HUD.
 */

(function () {
    const canvas = document.getElementById('heroCanvas');
    const staticImage = document.getElementById('heroStaticImage');
    const heroSection = document.querySelector('.hero-section');

    if (!canvas || !staticImage || !heroSection) return;

    // WebGL Context Initialization
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    if (!gl) {
        console.warn('WebGL not supported on this browser. Falling back to static image.');
        return;
    }

    // Vertex Shader Source
    const vsSource = `
        attribute vec2 position;
        varying vec2 v_uv;
        void main() {
            v_uv = position * 0.5 + 0.5; // Map from [-1,1] to [0,1]
            gl_Position = vec4(position, 0.0, 1.0);
        }
    `;

    // Fragment Shader Source
    const fsSource = `
        precision highp float;

        varying vec2 v_uv;

        uniform float u_time;
        uniform vec2 u_resolution;
        uniform vec2 u_mouse;
        uniform sampler2D u_image;
        
        uniform float u_image_aspect;
        uniform float u_canvas_aspect;

        // Particle uniform (x, y, size)
        uniform vec3 u_particles[20];

        // Green theme colors
        const vec3 colorGreenAccent = vec3(0.517, 0.909, 0.572); // #84E892
        const vec3 colorGreenCore = vec3(0.18, 0.49, 0.20);     // #2E7D32

        // Helper to draw a line segment
        float lineSegment(vec2 p, vec2 a, vec2 b, float width) {
            vec2 ab = b - a;
            vec2 ap = p - a;
            float t = clamp(dot(ap, ab) / dot(ab, ab), 0.0, 1.0);
            return smoothstep(width, 0.0, length(ap - ab * t));
        }

        void main() {
            vec2 uv = gl_FragCoord.xy / u_resolution.xy;

            // 1. Cover Aspect Ratio calculations for the texture
            vec2 uvCover = uv;
            if (u_canvas_aspect > u_image_aspect) {
                float ratio = u_image_aspect / u_canvas_aspect;
                uvCover.y = (uv.y - 0.5) * ratio + 0.5;
            } else {
                float ratio = u_canvas_aspect / u_image_aspect;
                uvCover.x = (uv.x - 0.5) * ratio + 0.5;
            }

            // 2. Interactive Lens Distortion (Refraction)
            vec2 mouseDir = uv - u_mouse;
            // Adjust mouseDir aspect ratio to make distortion circular
            mouseDir.x *= u_canvas_aspect;
            float distToMouse = length(mouseDir);
            
            // Lensing effect equation
            float lensRadius = 0.28;
            float strength = 0.0;
            if (distToMouse < lensRadius) {
                // Spherical refraction wave
                float normalizedDist = distToMouse / lensRadius;
                strength = sin(normalizedDist * 3.14159) * 0.035;
            }

            // Chromatic Aberration offset vectors
            vec2 offsetR = normalize(uv - u_mouse) * strength * 0.8;
            vec2 offsetG = normalize(uv - u_mouse) * strength * 0.4;
            vec2 offsetB = vec2(0.0);

            // Sample image with lens distortion & chromatic aberration
            vec4 texColor = vec4(0.0);
            texColor.r = texture2D(u_image, uvCover + offsetR).r;
            texColor.g = texture2D(u_image, uvCover + offsetG).g;
            texColor.b = texture2D(u_image, uvCover).b;
            texColor.a = 1.0;

            vec3 finalColor = texColor.rgb;

            // Normalize coordinate space centered at screen center
            vec2 p = (gl_FragCoord.xy - 0.5 * u_resolution.xy) / min(u_resolution.x, u_resolution.y);
            float r = length(p);
            float theta = atan(p.y, p.x);

            // 3. SnailShutter Spiral Aperture Effect (Center-placed overlay)
            // Snail-shell spiral math combined with rotating camera aperture
            float spiralTorsion = log(r + 0.08) * 4.5;
            float spiralVal = sin(spiralTorsion - theta + u_time * 0.4);
            float spiralLine = smoothstep(0.985, 1.0, 1.0 - abs(spiralVal));
            
            // Inner boundary for spiral
            float apertureCore = smoothstep(0.38, 0.12, r);
            float spiralGlow = spiralLine * apertureCore;

            // Combine spiral glow into the output color (screen blend)
            finalColor += colorGreenAccent * spiralGlow * 0.45;

            // Draw a subtle camera aperture center circle
            float circleEdge = abs(r - 0.38);
            float apertureRing = smoothstep(0.005, 0.0, circleEdge);
            finalColor += colorGreenAccent * apertureRing * 0.25;

            // 4. Floating Bokeh Particles
            float particleGlow = 0.0;
            for (int i = 0; i < 20; i++) {
                vec2 pPos = u_particles[i].xy;
                float pSize = u_particles[i].z;
                
                // Distance to particle
                float d = distance(uv, pPos);
                
                // Glow falloff
                particleGlow += (pSize * 0.0022) / (d * d + 0.0001);
            }
            finalColor += colorGreenAccent * particleGlow * 0.6;

            // 5. High-Tech Camera HUD Overlay
            // Center crosshair
            vec2 centerPix = gl_FragCoord.xy - 0.5 * u_resolution.xy;
            float crosshair = step(abs(centerPix.x), 1.0) * step(abs(centerPix.y), 12.0) +
                              step(abs(centerPix.y), 1.0) * step(abs(centerPix.x), 12.0);
            
            // Digital focal circle dots
            float dotDistance = abs(r - 0.08);
            float focalDots = smoothstep(0.004, 0.0, dotDistance) * step(0.94, sin(theta * 12.0));

            // Corner bracket overlays
            vec2 cornerDist = abs(uv - 0.5) * 2.0;
            float cornerBrackets = 0.0;
            if (cornerDist.x > 0.88 && cornerDist.y > 0.88) {
                float lineMask = step(0.92, cornerDist.x) + step(0.92, cornerDist.y);
                if (lineMask > 0.0 && cornerDist.x < 0.94 && cornerDist.y < 0.94) {
                    cornerBrackets = 1.0;
                }
            }

            // Tech scanning lines
            float scanline = sin(uv.y * 420.0 - u_time * 2.0) * 0.025;
            finalColor -= vec3(scanline);

            // Add HUD graphics
            finalColor += colorGreenAccent * (crosshair * 0.35 + focalDots * 0.5 + cornerBrackets * 0.4);

            // Vignette for cinematic framing
            float vignette = uv.x * uv.y * (1.0 - uv.x) * (1.0 - uv.y);
            vignette = clamp(pow(16.0 * vignette, 0.35), 0.0, 1.0);
            finalColor *= vignette;

            gl_FragColor = vec4(finalColor, 1.0);
        }
    `;

    // Compile shader helper
    function createShader(gl, type, source) {
        const shader = gl.createShader(type);
        gl.shaderSource(shader, source);
        gl.compileShader(shader);
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            console.error('An error occurred compiling the shaders: ' + gl.getShaderInfoLog(shader));
            gl.deleteShader(shader);
            return null;
        }
        return shader;
    }

    // Setup shaders and program
    const vertexShader = createShader(gl, gl.VERTEX_SHADER, vsSource);
    const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fsSource);
    if (!vertexShader || !fragmentShader) return;

    const program = gl.createProgram();
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        console.error('Unable to initialize the shader program: ' + gl.getProgramInfoLog(program));
        return;
    }

    gl.useProgram(program);

    // Geometry setup (full screen quad)
    const vertices = new Float32Array([
        -1.0, -1.0,
         1.0, -1.0,
        -1.0,  1.0,
        -1.0,  1.0,
         1.0, -1.0,
         1.0,  1.0,
    ]);

    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

    const positionLoc = gl.getAttribLocation(program, 'position');
    gl.enableVertexAttribArray(positionLoc);
    gl.vertexAttribPointer(positionLoc, 2, gl.FLOAT, false, 0, 0);

    // Uniform locations
    const uniforms = {
        time: gl.getUniformLocation(program, 'u_time'),
        resolution: gl.getUniformLocation(program, 'u_resolution'),
        mouse: gl.getUniformLocation(program, 'u_mouse'),
        image: gl.getUniformLocation(program, 'u_image'),
        imageAspect: gl.getUniformLocation(program, 'u_image_aspect'),
        canvasAspect: gl.getUniformLocation(program, 'u_canvas_aspect'),
        particles: gl.getUniformLocation(program, 'u_particles'),
    };

    // Load static image as texture
    let texture = gl.createTexture();
    let imageLoaded = false;
    const img = new Image();
    
    // Prevent CORS errors if loading external, but since local it's fine
    img.crossOrigin = "anonymous";
    img.src = staticImage.src;

    let imageAspect = 1.0;
    img.onload = function () {
        imageAspect = img.naturalWidth / img.naturalHeight;
        
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, texture);
        
        // Set texture parameters
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        
        // Flip texture coordinate Y to match WebGL coordinate system (prevent upside-down rendering)
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
        
        // Upload image to texture
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
        gl.uniform1i(uniforms.image, 0);
        
        imageLoaded = true;
        
        // Fade in canvas, fade out static image
        canvas.classList.add('loaded');
        staticImage.classList.add('fade-out');
        
        requestAnimationFrame(render);
    };

    // Track mouse coordinates
    let mouse = { x: 0.5, y: 0.5, targetX: 0.5, targetY: 0.5 };
    heroSection.addEventListener('mousemove', function (e) {
        const rect = heroSection.getBoundingClientRect();
        // Calculate relative coordinates in range [0, 1]
        mouse.targetX = (e.clientX - rect.left) / rect.width;
        // Invert Y because WebGL Y goes from bottom to top
        mouse.targetY = 1.0 - ((e.clientY - rect.top) / rect.height);
    });

    // Reset mouse to center when leaving hero section
    heroSection.addEventListener('mouseleave', function () {
        mouse.targetX = 0.5;
        mouse.targetY = 0.5;
    });

    // Initialize 20 particles
    const particleCount = 20;
    const particles = [];
    for (let i = 0; i < particleCount; i++) {
        particles.push({
            x: Math.random(),
            y: Math.random(),
            vx: (Math.random() - 0.5) * 0.0006,
            vy: Math.random() * 0.0008 + 0.0004, // constantly floats upward
            size: Math.random() * 0.015 + 0.005
        });
    }

    // Resize handler
    function resizeCanvas() {
        const dpr = Math.min(window.devicePixelRatio || 1, 2); // Cap at 2 for performance
        const width = heroSection.clientWidth;
        const height = heroSection.clientHeight;
        
        canvas.width = width * dpr;
        canvas.height = height * dpr;
        
        gl.viewport(0, 0, canvas.width, canvas.height);
    }

    window.addEventListener('resize', resizeCanvas);
    resizeCanvas();

    // Render loop
    let startTime = Date.now();
    function render() {
        if (!imageLoaded) return;

        // Smooth mouse dampening
        mouse.x += (mouse.targetX - mouse.x) * 0.08;
        mouse.y += (mouse.targetY - mouse.y) * 0.08;

        const time = (Date.now() - startTime) * 0.001;

        // Update particle positions
        const particleUniformData = [];
        for (let i = 0; i < particleCount; i++) {
            const p = particles[i];
            p.x += p.vx;
            p.y += p.vy;

            // Wrap particles around borders
            if (p.x < -0.1) p.x = 1.1;
            if (p.x > 1.1) p.x = -0.1;
            if (p.y > 1.1) {
                p.y = -0.1;
                p.x = Math.random();
            }

            particleUniformData.push(p.x, p.y, p.size);
        }

        // Clear canvas
        gl.clearColor(0, 0, 0, 1);
        gl.clear(gl.COLOR_BUFFER_BIT);

        // Bind texture
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, texture);

        // Set uniforms
        gl.uniform1f(uniforms.time, time);
        gl.uniform2f(uniforms.resolution, canvas.width, canvas.height);
        gl.uniform2f(uniforms.mouse, mouse.x, mouse.y);
        gl.uniform1f(uniforms.imageAspect, imageAspect);
        gl.uniform1f(uniforms.canvasAspect, canvas.width / canvas.height);

        // Send particle array data (uniform3fv)
        gl.uniform3fv(uniforms.particles, new Float32Array(particleUniformData));

        // Draw quad
        gl.drawArrays(gl.TRIANGLES, 0, 6);

        requestAnimationFrame(render);
    }
})();
