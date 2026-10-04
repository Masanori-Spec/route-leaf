# Existing products and useful difference

Research checked 2026-10-04. This is a portfolio prototype; market demand remains unvalidated.

- [PaperSurvey.io skip-logic documentation](https://www.papersurvey.io/help/form-design/article/skip-logic-conditional-questions) already offers automatic printed skip arrows. Its July 2026 documentation excludes multi-condition rules from automatic arrows and describes retrospective reminders/manual instructions. RouteLeaf's narrow difference is compiling earlier-answer context into separate cards so the destination beside the current answer is sufficient.
- [Snap XMP printed routing](https://www.snapsurveys.com/support-snapxmp/snapxmp/adding-routing/) supports answer-level and conditional after-question routing configured by the author. The inspected page does not describe the bounded XLSForm-to-contextual-card compilation implemented here.
- [PPP](https://github.com/pmaengineering/ppp), [Pureser](https://github.com/SwissTPH/Pureser), and [xlsform2word](https://github.com/cran/xlsform2word) already provide printable XLSForms/readable relevance. Ordinary format conversion is not this project's claimed difference.
- [Kobo documentation](https://github.com/kobotoolbox/docs/blob/master/source/data_through_webforms.md) describes printing all questions irrespective of logic. A [historical user report](https://community.kobotoolbox.org/t/printing-the-whole-questionnaire/500) discusses the practical difficulty of paper backups without navigation instructions. This motivates investigation, not proven demand for RouteLeaf.
- [Abstract questionnaires and FS-decision digraphs](https://arxiv.org/abs/2502.08522) studies reduced questionnaire graphs. This project makes no algorithmic novelty claim.

The bounded profile deliberately avoids uncertain blank/non-relevant comparisons. See the [ODK discussion on client differences](https://forum.getodk.org/t/blank-values-compare-differently-to-non-relevant-nodes-in-collect-and-enketo/47277). Actual official-engine and Web Forms checks are mandatory for the release example; broad compatibility claims are not justified by these tests.
