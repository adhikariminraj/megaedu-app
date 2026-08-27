export default function SiteFooter() {
  return (
    <footer className="border-t border-slate-200 bg-white mt-16">
      <div className="max-w-6xl mx-auto px-6 py-10 text-sm text-slate-500 flex flex-col md:flex-row justify-between gap-4">
        <p>© {new Date().getFullYear()} MEGA.EDU — Education for Everyone</p>
        <p>Built for Nepal&apos;s schools, teachers, students and parents.</p>
      </div>
    </footer>
  );
}
