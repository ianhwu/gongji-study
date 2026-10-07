const editions: Record<string, string> = {
  'interview-100.pdf':'老夏真题100题.pdf',
 'interview-framework.pdf':'结构化面试通用框架和模块.pdf',
 'top-study.pdf': '公基学霸笔记-上册-学习版.pdf',
  'bottom-study.pdf': '公基学霸笔记-下册-学习版.pdf',
};

// The same public editions are already hosted by this project's Pages portal.
// Stream them through the stable download URL without forwarding account data.
export async function GET(request: Request, context: { params: Promise<{ filename: string }> }) {
  const { filename } = await context.params;
  if (!Object.hasOwn(editions, filename)) return new Response('没有这份学习版资料。', { status: 404 });
  try {
    const source = await fetch('https://ianhwu.github.io/gongji-study/downloads/' + filename, { signal: request.signal });
    if (!source.ok) return new Response('资料暂时无法下载，请稍后重试。', { status: 503 });
    return new Response(source.body, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(editions[filename])}`,
        'Cache-Control': 'public, max-age=3600',
      },
    });
  } catch {
    return new Response('资料暂时无法下载，请稍后重试。', { status: 503 });
  }
}
