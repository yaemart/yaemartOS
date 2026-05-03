interface FaqItem {
  question: string;
  answer: string;
}

interface ProductFaqProps {
  faq?: FaqItem[];
}

export function ProductFaq({ faq }: ProductFaqProps) {
  if (!faq || faq.length === 0) {
    return null;
  }

  return (
    <section className="mt-8">
      <h2 className="mb-4 text-base font-semibold text-brand-text">常见问题</h2>
      <div className="divide-y divide-zinc-100 rounded-lg border border-zinc-200 bg-brand-surface">
        {faq.map((item, index) => (
          <details key={index} className="group px-4 py-1">
            <summary className="flex cursor-pointer items-center justify-between gap-4 py-3 text-sm font-medium text-brand-text select-none list-none [&::-webkit-details-marker]:hidden">
              <span>{item.question}</span>
              <svg
                className="h-4 w-4 shrink-0 text-brand-text-secondary transition-transform group-open:rotate-180"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 9l-7 7-7-7"
                />
              </svg>
            </summary>
            <p className="pb-4 text-sm leading-relaxed text-brand-text-secondary">{item.answer}</p>
          </details>
        ))}
      </div>
    </section>
  );
}
