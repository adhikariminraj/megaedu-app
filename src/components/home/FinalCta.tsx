import Link from "next/link";

export default function FinalCta({ isLoggedIn }: { isLoggedIn: boolean }) {
  if (isLoggedIn) return null;

  return (
    <section className="bg-mega-navy text-white">
      <div className="max-w-4xl mx-auto px-6 py-16 text-center">
        <h2 className="text-2xl md:text-3xl font-bold mb-3">Ready to join the network?</h2>
        <p className="text-slate-300 mb-8 max-w-xl mx-auto">
          One MEGA ID connects you to your school, your students, or your
          organization — in one place, verified.
        </p>
        <Link
          href="/register"
          className="inline-block bg-white text-mega-navy font-semibold px-10 py-3.5 rounded-full hover:bg-slate-100 transition text-lg"
        >
          Get Started
        </Link>
      </div>
    </section>
  );
}
