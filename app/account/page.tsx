import { chatGPTSignInPath, chatGPTSignOutPath, getChatGPTUser } from "../chatgpt-auth";

export const dynamic = "force-dynamic";

export default async function Account({ searchParams }: { searchParams: Promise<{ returnTo?: string }> }) {
  const params = await searchParams;
  let returnTo = "/study.html";
  try {
    const url = new URL(params.returnTo || returnTo, "https://app.local");
    if (url.origin === "https://app.local" && ["/", "/study.html"].includes(url.pathname)) {
      returnTo = url.pathname + url.search + url.hash;
    }
  } catch {}
  const user = await getChatGPTUser();
  return (
    <main className="min-h-screen bg-[#f5f7fb] px-5 py-12 text-[#172238]">
      <div className="mx-auto max-w-xl rounded-2xl border border-[#e1e7ef] bg-white p-7 shadow-sm">
        <a className="text-sm text-[#24599b]" href={returnTo}>← 返回刚才的学习位置</a>
        <h1 className="mt-6 text-3xl font-bold">学习账号</h1>
        {user ? (
          <>
            <p className="mt-4">已使用 <strong>{user.displayName}</strong> 登录。</p>
            <p className="mt-2 text-[#576579]">课程进度、答题记录和错题会保存到这个账号，并在你使用同一账号的设备间同步。</p>
            <div className="mt-7 flex flex-wrap gap-3">
              <a className="rounded-lg bg-[#24599b] px-5 py-3 text-white" href={returnTo}>继续学习</a>
              <a className="rounded-lg border border-[#bac8d8] px-5 py-3 text-[#24599b]" href={chatGPTSignOutPath("/account")}>退出登录</a>
            </div>
          </>
        ) : (
          <>
            <p className="mt-4 text-[#576579]">登录后才能保存答题与错题，并在其他设备继续学习。课程和资料仍可浏览。</p>
            <a className="mt-7 inline-block rounded-lg bg-[#24599b] px-5 py-3 text-white" href={chatGPTSignInPath(returnTo)} target="_top">使用 ChatGPT 账号登录</a>
          </>
        )}
      </div>
    </main>
  );
}
