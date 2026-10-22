export default function Home() {
  return (
    <main className="shell">
      <section className="intro">
        <p className="eyebrow">GuardianGate · Local prototype</p>
        <h1>Quyền truy cập hồ sơ được quyết định bởi policy.</h1>
        <p className="lede">
          TideCloak xác thực danh tính. GuardianGate chỉ mở đúng nhóm dữ liệu, đúng mục đích và
          đúng thời hạn sau khi đủ phê duyệt.
        </p>
        <div className="status-row">
          <span className="status-dot" aria-hidden="true" />
          <span>Codebase đang ở giai đoạn tích hợp backend.</span>
        </div>
      </section>
    </main>
  );
}
