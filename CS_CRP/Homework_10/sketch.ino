/*
 * =====================================================
 *  Heuser College - CS CRP Homework 10
 *  Project 3: Smooth 4-Joint Robotic Arm &
 *             Colour Choreographer
 *
 *  A K-pop-inspired dance routine performed by four
 *  servo motors with synchronised RGB LED colour
 *  changes, using PWM on an ESP32.
 *
 *  Platform: ESP32 (Wokwi Simulator)
 *  Library:  ESP32Servo
 * =====================================================
 */

#include <ESP32Servo.h>

// ==========================================================
//  PIN DEFINITIONS  (must match diagram.json — do not change)
// ==========================================================
const int SERVO1_PIN = 13;   // Joint 1 — Base
const int SERVO2_PIN = 14;   // Joint 2 — Shoulder
const int SERVO3_PIN = 18;   // Joint 3 — Elbow
const int SERVO4_PIN = 19;   // Joint 4 — Wrist

const int RED_PIN   = 25;    // RGB LED red anode
const int GREEN_PIN = 26;    // RGB LED green anode
const int BLUE_PIN  = 27;    // RGB LED blue anode

// ==========================================================
//  LEDC PWM FOR THE RGB LED (Core 3.x API)
//  In Core 3.x, ledcAttach() and ledcWrite() address GPIO
//  pins directly — no manual channel numbers are needed.
// ==========================================================

// ==========================================================
//  SERVO OBJECTS AND POSITION TRACKING
// ==========================================================
Servo servo1, servo2, servo3, servo4;

// Array of pointers so we can loop through servos easily
Servo* servos[4];

// Current angle of each servo (updated after every move)
int currentAngle[4] = {90, 90, 90, 90};

// Safe angle limits for the simulation
const int MIN_ANGLE = 20;
const int MAX_ANGLE = 160;
const int MID_ANGLE = 90;

// Number of small steps used for each smooth movement (high-resolution interpolation)
const int MOVE_STEPS = 100;

// ==========================================================
//  EASING FUNCTION
// ==========================================================
/*
 * easeInOut(t) converts a linear progress value (0.0 to 1.0)
 * into a smoothed value using a cosine curve:
 *
 *   output = (1 - cos(t * PI)) / 2
 *
 *   t = 0.0  →  output = 0.0  (start — servo is stationary)
 *   t = 0.25 →  output ≈ 0.15 (slowly picking up speed)
 *   t = 0.5  →  output = 0.5  (midpoint — moving fastest)
 *   t = 0.75 →  output ≈ 0.85 (slowing down)
 *   t = 1.0  →  output = 1.0  (end — servo stops smoothly)
 *
 * This creates natural-looking motion: slow start, fast
 * middle, slow finish — just like a real dancer's movement.
 */
float easeInOut(float t) {
  return (1.0 - cos(t * PI)) / 2.0;
}

// ==========================================================
//  SERVO MOVEMENT FUNCTIONS
// ==========================================================

/*
 * smoothMoveAll() moves all four servos at the same time
 * from their current positions to new target angles.
 * The movement is split into many tiny steps, each one
 * calculated with the easing function so the motion
 * looks smooth instead of jerky.
 */
void smoothMoveAll(int t1, int t2, int t3, int t4, int durationMs) {
  // Keep targets within the safe range
  int targets[4] = {
    constrain(t1, MIN_ANGLE, MAX_ANGLE),
    constrain(t2, MIN_ANGLE, MAX_ANGLE),
    constrain(t3, MIN_ANGLE, MAX_ANGLE),
    constrain(t4, MIN_ANGLE, MAX_ANGLE)
  };

  // Save where each servo is right now
  int starts[4];
  for (int j = 0; j < 4; j++) {
    starts[j] = currentAngle[j];
  }

  // Step through the movement in small increments (at least 1 ms per step)
  int stepDelay = max(1, durationMs / MOVE_STEPS);
  for (int i = 0; i <= MOVE_STEPS; i++) {
    float t = (float)i / (float)MOVE_STEPS;   // linear 0→1
    float e = easeInOut(t);                   // smoothed 0→1

    for (int j = 0; j < 4; j++) {
      // Use round() instead of integer truncation for precise, symmetrical angle stepping
      int angle = round(starts[j] + (targets[j] - starts[j]) * e);
      servos[j]->write(angle);
    }
    delay(stepDelay);
  }

  // Record where the servos ended up
  for (int j = 0; j < 4; j++) {
    currentAngle[j] = targets[j];
  }
}

/*
 * smoothMoveOne() moves a single servo (by index 0-3)
 * while the other three hold still.
 */
void smoothMoveOne(int index, int targetAngle, int durationMs) {
  int t[4];
  for (int j = 0; j < 4; j++) {
    t[j] = currentAngle[j];        // keep current position
  }
  t[index] = targetAngle;           // only change the chosen servo
  smoothMoveAll(t[0], t[1], t[2], t[3], durationMs);
}

// ==========================================================
//  RGB LED FUNCTIONS
// ==========================================================

/*
 * setColour() sets the LED to a colour immediately.
 * Each parameter is 0 (off) to 255 (full brightness).
 * Because the LED is common cathode, a higher PWM duty
 * cycle means a brighter colour channel.
 */
void setColour(int r, int g, int b) {
  ledcWrite(RED_PIN,   r);
  ledcWrite(GREEN_PIN, g);
  ledcWrite(BLUE_PIN,  b);
}

/*
 * fadeToColour() smoothly transitions the LED from
 * colour (r1,g1,b1) to colour (r2,g2,b2) over the
 * given duration, so the light change looks gradual.
 */
void fadeToColour(int r1, int g1, int b1,
                  int r2, int g2, int b2, int durationMs) {
  const int FADE_STEPS = 50;
  int stepDelay = max(1, durationMs / FADE_STEPS);
  for (int i = 0; i <= FADE_STEPS; i++) {
    float t = (float)i / (float)FADE_STEPS;
    setColour(
      round(r1 + (r2 - r1) * t),
      round(g1 + (g2 - g1) * t),
      round(b1 + (b2 - b1) * t)
    );
    delay(stepDelay);
  }
}

// ==========================================================
//  DANCE SECTIONS
// ==========================================================

/* ---- SECTION 1: Starting Pose ----
 * The arm rises from rest to an asymmetric "ready" stance,
 * like a dancer waiting for the music to drop.
 * LED: calm blue glow.
 */
void danceStartingPose() {
  Serial.println("\n>> SECTION 1: Starting Pose");
  setColour(0, 0, 255);                        // Blue
  smoothMoveAll(90, 90, 90, 90, 800);           // Centre all joints
  delay(300);
  smoothMoveAll(60, 120, 45, 135, 600);         // Asymmetric ready stance
  delay(500);
}

/* ---- SECTION 2: Synchronised Hit ----
 * All four joints strike the same angle at the same time,
 * like a K-pop group hitting a formation in unison.
 * LED: hot pink — high energy.
 */
void danceSynchronised() {
  Serial.println(">> SECTION 2: Synchronised Hit");
  setColour(255, 0, 100);                       // Hot pink

  // Full-range synchronised hits
  smoothMoveAll(140, 140, 140, 140, 500);
  delay(200);
  smoothMoveAll(40, 40, 40, 40, 500);
  delay(200);

  // Quick double pump
  smoothMoveAll(130, 130, 130, 130, 300);
  delay(100);
  smoothMoveAll(50, 50, 50, 50, 300);
  delay(100);

  // Return to centre
  smoothMoveAll(90, 90, 90, 90, 400);
  delay(300);
}

/* ---- SECTION 3: Side-to-Side Sway ----
 * Odd-numbered joints (1 & 3) go one way while
 * even-numbered joints (2 & 4) go the other, then
 * they swap — creating a swaying, groovy motion.
 * LED: mint green — fresh groove.
 */
void danceSideToSide() {
  Serial.println(">> SECTION 3: Side-to-Side Sway");
  setColour(0, 255, 100);                       // Mint green

  for (int rep = 0; rep < 3; rep++) {
    smoothMoveAll(40, 140, 40, 140, 500);       // Odds left, evens right
    delay(100);
    smoothMoveAll(140, 40, 140, 40, 500);       // Swap
    delay(100);
  }

  smoothMoveAll(90, 90, 90, 90, 400);           // Centre
  delay(200);
}

/* ---- SECTION 4: Sequential Wave / Ripple ----
 * Each joint moves one after the other, creating a
 * wave that travels down the arm and back — like
 * a stadium wave or the ripple in a dance line.
 * LED: warm orange.
 */
void danceWaveRipple() {
  Serial.println(">> SECTION 4: Wave Ripple");
  setColour(255, 150, 0);                       // Orange

  for (int rep = 0; rep < 2; rep++) {
    // Wave travels forward: joint 1 → 2 → 3 → 4
    smoothMoveOne(0, 140, 250);
    smoothMoveOne(1, 140, 250);
    smoothMoveOne(2, 140, 250);
    smoothMoveOne(3, 140, 250);

    // Wave returns: joint 4 → 3 → 2 → 1
    smoothMoveOne(3, 40, 250);
    smoothMoveOne(2, 40, 250);
    smoothMoveOne(1, 40, 250);
    smoothMoveOne(0, 40, 250);
  }

  smoothMoveAll(90, 90, 90, 90, 400);           // Settle
  delay(200);
}

/* ---- SECTION 5: Playful Bounce ----
 * Quick, bouncy movements with small fast wiggles,
 * like a playful ad-lib section in a dance break.
 * LED: bright yellow — fun and energetic.
 */
void dancePlayful() {
  Serial.println(">> SECTION 5: Playful Bounce");
  setColour(255, 255, 0);                       // Yellow

  // Criss-cross bounces
  smoothMoveAll(70, 110, 50, 130, 300);
  delay(100);
  smoothMoveAll(110, 70, 130, 50, 300);
  delay(100);

  // Fast wiggle — small oscillations
  for (int i = 0; i < 4; i++) {
    smoothMoveAll(80, 100, 80, 100, 150);
    smoothMoveAll(100, 80, 100, 80, 150);
  }

  // Dramatic spread then snap to centre
  smoothMoveAll(30, 150, 30, 150, 400);
  delay(200);
  smoothMoveAll(90, 90, 90, 90, 300);
  delay(200);
}

/* ---- SECTION 6: Final Pose ----
 * A slow, dramatic finish: the arm spreads wide,
 * locks into a sharp ending pose, the LED flashes
 * white and then fades to black.
 * LED: purple → white flash → fade to black.
 */
void danceFinalPose() {
  Serial.println(">> SECTION 6: Final Pose");
  setColour(200, 0, 255);                       // Purple

  // Slow dramatic spread
  smoothMoveAll(30, 150, 60, 120, 800);
  delay(300);

  // Sharp final hit
  smoothMoveAll(45, 135, 90, 90, 400);
  delay(200);

  // White flash for the ending
  setColour(255, 255, 255);
  delay(800);

  // Fade to black
  fadeToColour(255, 255, 255,  0, 0, 0,  1000);

  Serial.println("\n*** ROUTINE COMPLETE — Restarting... ***\n");
  delay(1500);
}

// ==========================================================
//  SETUP — runs once when the ESP32 starts
// ==========================================================
void setup() {
  // Start the Serial Monitor at 115200 baud
  Serial.begin(115200);
  delay(500);
  Serial.println("=============================================");
  Serial.println("  Heuser College HW10");
  Serial.println("  K-Pop Robotic Arm Choreographer");
  Serial.println("  4 Servos + RGB LED  |  ESP32 + PWM");
  Serial.println("=============================================");

  // --- Servo Initialisation ---
  // Allocate the ESP32's four hardware timers for PWM
  ESP32PWM::allocateTimer(0);
  ESP32PWM::allocateTimer(1);
  ESP32PWM::allocateTimer(2);
  ESP32PWM::allocateTimer(3);

  // Configure each servo for 50 Hz and attach to its GPIO pin
  // 500-2400 microsecond pulse range maps 0-180 degrees
  servo1.setPeriodHertz(50);
  servo2.setPeriodHertz(50);
  servo3.setPeriodHertz(50);
  servo4.setPeriodHertz(50);

  servo1.attach(SERVO1_PIN, 500, 2400);
  servo2.attach(SERVO2_PIN, 500, 2400);
  servo3.attach(SERVO3_PIN, 500, 2400);
  servo4.attach(SERVO4_PIN, 500, 2400);

  // Fill the pointer array so loops can address any servo by index
  servos[0] = &servo1;
  servos[1] = &servo2;
  servos[2] = &servo3;
  servos[3] = &servo4;

  // --- RGB LED Initialisation (Core 3.x API) ---
  // ledcAttach(pin, freq, resolution) configures and binds in one call.
  // 5 kHz frequency, 8-bit resolution gives duty cycle values 0-255.
  ledcAttach(RED_PIN,   5000, 8);
  ledcAttach(GREEN_PIN, 5000, 8);
  ledcAttach(BLUE_PIN,  5000, 8);

  // Start with everything at rest
  servo1.write(MID_ANGLE);
  servo2.write(MID_ANGLE);
  servo3.write(MID_ANGLE);
  servo4.write(MID_ANGLE);
  setColour(0, 0, 0);

  Serial.println("All servos and RGB LED initialised.");
  Serial.println("Starting K-Pop dance routine...\n");
  delay(1000);
}

// ==========================================================
//  MAIN LOOP — repeats the full dance routine forever
// ==========================================================
void loop() {
  danceStartingPose();      // Section 1 — ready stance
  danceSynchronised();       // Section 2 — group hit
  danceSideToSide();         // Section 3 — swaying groove
  danceWaveRipple();         // Section 4 — ripple wave
  dancePlayful();            // Section 5 — bouncy ad-lib
  danceFinalPose();          // Section 6 — dramatic ending
}
