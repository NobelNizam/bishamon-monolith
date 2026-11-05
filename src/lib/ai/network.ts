/** Only controlled messages cross the provider boundary; never persist an upstream body. */
export class ProviderError extends Error {}

export async function requestText(url: string, init: RequestInit, timeout: number, limit = 2_000_000): Promise<string> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const operation = async () => {
    const response = await fetch(url, { ...init, signal: controller.signal, redirect: 'error' });
    if (!response.ok) {
      await response.body?.cancel();
      throw new ProviderError(`Layanan mengembalikan HTTP ${response.status}.`);
    }
    if (!response.body) throw new ProviderError('Respons layanan kosong.');
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > limit) {
          await reader.cancel();
          throw new ProviderError('Respons layanan melebihi batas ukuran.');
        }
        chunks.push(value);
      }
    } finally {
      reader.releaseLock();
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    return new TextDecoder().decode(bytes);
  };
  try {
    return await Promise.race([
      operation(),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          reject(new ProviderError('Batas waktu layanan terlampaui.'));
          controller.abort();
        }, timeout);
      }),
    ]);
  } catch (error) {
    if (error instanceof ProviderError) throw error;
    throw new ProviderError('Layanan tidak dapat dihubungi atau respons tidak terbaca.');
  } finally {
    clearTimeout(timer);
  }
}
