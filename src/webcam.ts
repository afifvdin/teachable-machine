/** One shared camera stream that any number of <video> elements can show. */
export class Webcam {
  private stream: MediaStream | null = null;
  private starting: Promise<MediaStream> | null = null;
  private videos = new Set<HTMLVideoElement>();
  facing: 'user' | 'environment' = 'user';

  get mirrored() {
    return this.facing === 'user';
  }

  async attach(video: HTMLVideoElement) {
    this.videos.add(video);
    try {
      const stream = await this.start();
      this.show(video, stream);
    } catch (e) {
      this.videos.delete(video);
      throw e;
    }
  }

  detach(video: HTMLVideoElement) {
    video.srcObject = null;
    this.videos.delete(video);
    if (!this.videos.size) this.stop();
  }

  async flip() {
    this.facing = this.mirrored ? 'environment' : 'user';
    this.stop();
    const stream = await this.start();
    for (const v of this.videos) this.show(v, stream);
  }

  private show(video: HTMLVideoElement, stream: MediaStream) {
    video.muted = true;
    video.playsInline = true;
    video.srcObject = stream;
    video.classList.toggle('mirror', this.mirrored);
    video.play().catch(() => {});
  }

  private start() {
    if (this.stream) return Promise.resolve(this.stream);
    if (!navigator.mediaDevices?.getUserMedia) return Promise.reject(new Error('Camera is not supported in this browser'));
    this.starting ??= navigator.mediaDevices
      .getUserMedia({ video: { facingMode: this.facing, width: { ideal: 640 }, height: { ideal: 480 } }, audio: false })
      .then((s) => (this.stream = s))
      .finally(() => (this.starting = null));
    return this.starting;
  }

  private stop() {
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
  }
}
