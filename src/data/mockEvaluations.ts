export const mockEvaluations = [
  {
    request_id: "10837201-7f10-40b2-bae0-5d3ac0642ff6",
    evaluations: {
      standard_math_3_oa_a_2_mcq_easy_002: {
        score: 0.9545454545454546,
        ti_question_qa: {
          issues: [],
          scores: {
            correctness: 1.0,
            di_compliance: 0.9,
            grade_alignment: 1.0,
            query_relevance: 1.0,
            language_quality: 0.9,
            format_compliance: 1.0,
            pedagogical_value: 0.9,
            explanation_quality: 0.9,
            difficulty_alignment: 1.0,
            instruction_adherence: 1.0
          },
          overall: 0.9666666666666666,
          di_scores: {
            overall: 0.9,
            grade_language: 0.9,
            format_alignment: 0.9,
            general_principles: 0.9
          },
          strengths: [
            "Correct answer mapping and value present.",
            "Clear and concise language appropriate for grade 3.",
            "Explanation provides clear reasoning for the solution."
          ],
          recommendation: "accept",
          section_evaluations: {
            question: {
              issues: [],
              strengths: [
                "Correct answer mapping and value present.",
                "Clear and concise language appropriate for grade 3."
              ],
              section_score: 9.71,
              recommendation: "accept"
            },
            scaffolding: {
              issues: [],
              strengths: [
                "Explanation provides clear reasoning for the solution."
              ],
              section_score: 9.0,
              recommendation: "accept"
            }
          },
          suggested_improvements: [
            "Consider adding a visual representation to enhance understanding."
          ]
        },
        answer_verification: {
          reasoning: "20 divided by 5 rows equals 4 dots per row.",
          confidence: 10,
          is_correct: true,
          correct_answer: "4"
        },
        reading_question_qc: {
          passed: true,
          overall_score: 0.9,
          question_checks: {
            clarity_precision: {
              score: 1,
              category: "question",
              response: "The question is clear, precise, and unambiguous. It uses simple, direct language appropriate for elementary students learning division."
            },
            passage_reference: {
              score: 1,
              category: "question",
              response: "The question does not contain any specific structural references to the passage."
            },
            standard_alignment: {
              score: 1,
              category: "question",
              response: "The question directly assesses the assigned standard 'Writing Division Sentences for Arrays.'"
            },
            single_correct_answer: {
              score: 1,
              category: "question",
              response: "The question asks for the number of dots in each row when 20 dots are arranged in 5 equal rows. This is a straightforward division problem: 20 ÷ 5 = 4."
            }
          },
          distractor_checks: {
            too_close: {
              score: 1,
              category: "distractor",
              response: "All distractors are numerically distinct and not synonymous with 4; only C is supported by 20 ÷ 5."
            },
            homogeneity: {
              score: 0,
              category: "distractor",
              response: "Legacy format: No clear positive indicators"
            },
            length_check: {
              score: 1,
              category: "distractor",
              response: "All choices are 3 words or less"
            },
            plausibility: {
              score: 1,
              category: "distractor",
              response: "All incorrect choices represent plausible misconceptions."
            },
            specificity_balance: {
              score: 1,
              category: "distractor",
              response: "All four answer choices are simple single numbers presented in the exact same format."
            },
            grammatical_parallel: {
              score: 1,
              category: "distractor",
              response: "All answer choices follow the same grammatical pattern - they are all single numbers."
            }
          }
        },
        math_content_evaluator: {
          fail_count: 0,
          pass_count: 9,
          image_quality: "PASS",
          overall_score: 1.0,
          overall_rating: "ACCEPTABLE",
          cognitive_demand: "PASS",
          accuracy_and_rigor: "PASS",
          curriculum_alignment: "PASS",
          instructional_support: "PASS",
          reveals_misconceptions: "PASS",
          engagement_and_relevance: "PASS",
          clarity_and_accessibility: "PASS",
          question_type_appropriateness: "PASS"
        }
      }
    },
    inceptbench_version: "1.5.4",
    evaluation_time_seconds: 38.44764518737793
  }
];
