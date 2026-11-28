import { Accordion } from "@base-ui/react/accordion";
import { MinusIcon } from "@phosphor-icons/react/dist/ssr/Minus";
import { PlusIcon } from "@phosphor-icons/react/dist/ssr/Plus";

import { faqs } from "../faqs";

export function FAQsSection() {
  return (
    <section
      id="faqs"
      aria-labelledby="faqs-heading"
      className="content-grid bg-background text-foreground scroll-mt-22 py-24 font-sans md:scroll-mt-28 dark:bg-[#151b28]"
    >
      <div className="grid w-full grid-cols-1 gap-12 md:grid-cols-[368px_minmax(0,1fr)] md:gap-24">
        <header>
          <p className="text-primary text-xs leading-5 font-semibold tracking-[0.08em] uppercase dark:text-[#79c7ff]">
            Frequently asked questions
          </p>

          <h2
            id="faqs-heading"
            className="font-display mt-4 max-w-[368px] text-[56px] leading-[60px] font-semibold tracking-[-0.02em]"
          >
            <span className="block">Before you</span>
            <span className="block">step inside.</span>
          </h2>
        </header>

        <Accordion.Root
          aria-label="Frequently asked questions"
          defaultValue={["audience"]}
          className="border-border-subtle border-t dark:border-[#2b3b5f]"
        >
          {faqs.map(({ id, question, answer }) => (
            <Accordion.Item
              key={id}
              value={id}
              className="border-border-subtle border-b dark:border-[#2b3b5f]"
            >
              <Accordion.Header className="m-0">
                <Accordion.Trigger className="group text-foreground hover:text-primary dark:hover:text-brand-foreground focus-visible:ring-primary dark:focus-visible:ring-brand-foreground flex min-h-[3.5rem] w-full cursor-pointer items-center justify-between gap-4 py-6 text-left text-xl leading-7 font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-inset">
                  <span>{question}</span>

                  <span className="text-primary dark:text-brand-foreground grid size-5 shrink-0 place-items-center">
                    <PlusIcon
                      aria-hidden
                      size={16}
                      weight="regular"
                      className="group-data-panel-open:hidden"
                    />
                    <MinusIcon
                      aria-hidden
                      size={16}
                      weight="regular"
                      className="hidden group-data-panel-open:block"
                    />
                  </span>
                </Accordion.Trigger>
              </Accordion.Header>

              <Accordion.Panel className="h-(--accordion-panel-height) overflow-hidden transition-[height,opacity] duration-200 ease-out data-[ending-style]:h-0 data-[ending-style]:opacity-0 data-[starting-style]:h-0 data-[starting-style]:opacity-0 motion-reduce:transition-none">
                <p className="text-foreground-secondary max-w-[816px] pb-6 text-base leading-[160%] dark:text-[#abb9d8]">
                  {answer}
                </p>
              </Accordion.Panel>
            </Accordion.Item>
          ))}
        </Accordion.Root>
      </div>
    </section>
  );
}
