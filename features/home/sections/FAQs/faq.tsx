import { Accordion } from "@base-ui/react/accordion";
import { MinusIcon } from "@phosphor-icons/react/dist/ssr/Minus";
import { PlusIcon } from "@phosphor-icons/react/dist/ssr/Plus";

const faqs = [
  {
    id: "audience",
    question: "Who is Campus by Rise for?",
    answer:
      "Campus is for invited members of the Rise community: learners, instructors, facilitators, mentors and the administrators who support them.",
  },
  {
    id: "account",
    question: "Can anyone create an account?",
    answer:
      "Campus is invitation-only. Your Rise programme administrator can send you an invitation with the right access for your cohort and role.",
  },
  {
    id: "sign-in",
    question: "How do I sign in?",
    answer:
      "Accept your invitation and complete your profile and onboarding. After that, use Google to sign in and return to Campus.",
  },
  {
    id: "classroom-slack",
    question: "Does Campus replace Rise Classroom or Slack?",
    answer:
      "Campus is a shared place to meet your cohort and mentors. You can continue using Rise Classroom for your learning materials and the other tools your programme uses.",
  },
  {
    id: "camera",
    question: "Do I need to keep my camera on?",
    answer:
      "No. You choose when to turn on your camera and microphone, and can update your availability whenever you need to.",
  },
  {
    id: "classrooms",
    question: "Can I enter any classroom or meeting?",
    answer:
      "Rooms are part of your Campus spaces. Join the rooms available to you for your cohort, class or meeting.",
  },
  {
    id: "updates",
    question: "How do I keep track of classes and updates?",
    answer:
      "Check your Campus spaces for class and meeting details, and visit the Notice Wall for announcements and updates.",
  },
];

export function FAQsSection() {
  return (
    <section
      id="faqs"
      aria-labelledby="faqs-heading"
      className="content-grid bg-background text-foreground scroll-mt-22 py-24 font-sans md:scroll-mt-28"
    >
      <div className="grid w-full grid-cols-1 gap-12 md:grid-cols-[368px_minmax(0,1fr)] md:gap-24">
        <header>
          <p className="text-primary text-xs leading-5 font-semibold tracking-[0.08em] uppercase">
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
          className="border-border-subtle border-t"
        >
          {faqs.map(({ id, question, answer }) => (
            <Accordion.Item
              key={id}
              value={id}
              className="border-border-subtle border-b"
            >
              <Accordion.Header className="m-0">
                <Accordion.Trigger className="group text-foreground hover:text-primary focus-visible:ring-primary flex min-h-[3.5rem] w-full cursor-pointer items-center justify-between gap-4 py-6 text-left text-xl leading-7 font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-inset">
                  <span>{question}</span>

                  <span className="text-primary grid size-5 shrink-0 place-items-center">
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
                <p className="text-foreground-secondary max-w-[816px] pb-6 text-base leading-[160%]">
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
