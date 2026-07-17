/**
 * TV Mix — modo en vivo: helpers WebRTC compartidos entre consola (emisora de
 * mic/cámara) y TV (receptora). Señalización sin trickle: se espera el ICE
 * gathering completo y se intercambia un solo SDP por lado (vía el API de la
 * sala con polling, y por BroadcastChannel como atajo en fase espejo).
 */

export const RTC_CONFIG: RTCConfiguration = {
  // STUN público basta: consola y TV suelen estar en la misma red (candidatos
  // host). Entre redes distintas haría falta TURN — fuera de alcance.
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
};

export function newLiveSessionId(): string {
  return Math.random().toString(36).slice(2, 10);
}

/** Espera a que termine el ICE gathering (o el timeout) para un SDP completo. */
export function waitIceComplete(pc: RTCPeerConnection, timeoutMs = 2500): Promise<void> {
  if (pc.iceGatheringState === "complete") return Promise.resolve();
  return new Promise((resolve) => {
    const timer = window.setTimeout(done, timeoutMs);
    function check() {
      if (pc.iceGatheringState === "complete") done();
    }
    function done() {
      window.clearTimeout(timer);
      pc.removeEventListener("icegatheringstatechange", check);
      resolve();
    }
    pc.addEventListener("icegatheringstatechange", check);
  });
}
