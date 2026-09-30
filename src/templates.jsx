/**
 * @file templates.jsx
 * Library of prompt templates for LLM-assisted conceptual modeling,
 * along with utilities for retrieval and population.
 */

/**
 * Derives placeholder tokens from a template structure string.
 * Tokens within [square brackets] are marked as optional (required: false).
 *
 * @param {string|null} structure - Template structure with <placeholder> and [optional] syntax.
 * @returns {Array<{ key: string, required: boolean }>} Derived placeholders.
 */
function derivePlaceholders(structure) {
  if (!structure) return [];

  // Match optional segments enclosed in square brackets
  const optionalSegments = [];
  const bracketRegex = /\[([^\]]*)\]/g;
  let bracketMatch;
  while ((bracketMatch = bracketRegex.exec(structure)) !== null) {
    optionalSegments.push(bracketMatch[1]);
  }

  const placeholders = [];
  const tokenRegex = /<([^>]+)>/g;
  let tokenMatch;

  while ((tokenMatch = tokenRegex.exec(structure)) !== null) {
    const key = tokenMatch[1];
    // A placeholder is optional if it sits within any optional square-bracket segment
    const isOptional = optionalSegments.some((seg) => seg.includes(`<${key}>`));
    placeholders.push({
      key,
      required: !isOptional,
    });
  }

  return placeholders;
}

/**
 * Collection of 9 prompt templates for LLM-assisted conceptual modeling.
 * @type {Array<{
 *   id: string,
 *   name: string,
 *   description: string,
 *   purpose: string|null,
 *   structure: string|null,
 *   placeholders: Array<{ key: string, required: boolean }>,
 *   notes: string|null,
 *   examples: string[]
 * }>}
 */
export const TEMPLATES = [
  {
    id: 'create-model',
    name: 'Create Model',
    description: 'Prompts related to the creation of a (potentially partial) model',
    purpose: 'Create a (potentially partial) model',
    structure:
      'Create a <model> from the following description. [Present the response in the following format: <format>.] The description: <desc>',
    placeholders: [
      { key: 'model', required: true },
      { key: 'format', required: false },
      { key: 'desc', required: true },
    ],
    notes: null,
    examples: [
      "Create a class diagram from the following description. Present the response in the following format: PlantUML. The description: A University is interested in an information system that will assist in managing books. Each book has a title and one or more authors (e.g., Don Quixote, Miguel de Cervantes). In addition to the authors' names, their date of birth and death (if they are deceased) are also stored.",
    ],
  },
  {
    id: 'update-model',
    name: 'Update Model',
    description: 'Prompts related to the update of a (potentially partial) model',
    purpose: 'Update a (potentially partial) model',
    structure:
      'Modify the <model> to address the following concern. [Present the response in the following format: <format>.] The concern: <conc>',
    placeholders: [
      { key: 'model', required: true },
      { key: 'format', required: false },
      { key: 'conc', required: true },
    ],
    notes: null,
    examples: [
      'Modify the class diagram to address the following concern. The concern: the previous suggestion do not support multiple authors writing a single book.',
    ],
  },
  {
    id: 'create-list',
    name: 'Create List',
    description: "Prompts related to the creation of an elements' list",
    purpose: "Create an elements' list",
    structure:
      'Create a list of <elements> from the following description. [Present the response in the following format: <format>.] The description: <desc>',
    placeholders: [
      { key: 'elements', required: true },
      { key: 'format', required: false },
      { key: 'desc', required: true },
    ],
    notes: null,
    examples: [
      "Create a list of classes from the following description. The Description: A University is interested in an information system that will assist in managing books. Each book has a title and one or more authors (e.g., Don Quixote, Miguel de Cervantes). In addition to the authors' names, their date of birth and death (if they are deceased) are also stored.",
    ],
  },
  {
    id: 'update-list',
    name: 'Update List',
    description: "Prompts related to the update of an elements' list",
    purpose: "Update an elements' list",
    structure:
      'Modify the list of <elements> to address the following concern. [Present the response in the following format: <format>.] The concern: <conc>',
    placeholders: [
      { key: 'elements', required: true },
      { key: 'format', required: false },
      { key: 'conc', required: true },
    ],
    notes: null,
    examples: [
      'Modify the list of classes to address the following concern. Present the response in the following format: a table with 3 columns – class name, attributes, operations. The concern: the previous suggestion does not support multiple authors writing a single book.',
    ],
  },
  {
    id: 'generate-model',
    name: 'Generate Model',
    description:
      'Prompts asking to generate a model from lists, appearing in previous prompts or responses',
    purpose: 'Generate a model from lists',
    structure:
      'Generate a <model> from <source>. [Present the response in the following format: <format>.]',
    placeholders: [
      { key: 'model', required: true },
      { key: 'source', required: true },
      { key: 'format', required: false },
    ],
    notes: null,
    examples: [
      'Generate a class diagram from the list of classes generated in the previous prompt. Present the response in the following format: PlantUML.',
    ],
  },
  {
    id: 'present',
    name: 'Present',
    description: 'Prompts asking to present/visualize the response in a certain way',
    purpose: 'Present/Visualize the response in a certain [different] way',
    structure:
      'Present the previous response in the following format: <format>.',
    placeholders: [{ key: 'format', required: true }],
    notes: null,
    examples: ['Present the previous response in the following format: XMI.'],
  },
  {
    id: 'explain',
    name: 'Explain',
    description: 'Prompts asking to explain responses of the LLM',
    purpose: 'Explain (previous) responses of the LLM',
    structure:
      'Explain why <phenomenon>. [Present the response in the following format: <format>.]',
    placeholders: [
      { key: 'phenomenon', required: true },
      { key: 'format', required: false },
    ],
    notes: null,
    examples: [
      'Explain why an author is a class. Present the response in the following format: a list of arguments to support the suggestion.',
    ],
  },
  {
    id: 'discuss',
    name: 'Discuss',
    description:
      'Prompts asking to discuss possible solutions (presented either explicitly or implicitly), appearing in previous prompts or responses',
    purpose: 'Discuss possible solutions',
    structure:
      'Discuss the following options [in the setting of <setting>] [considering <metric> measures]. [Present the response in the following format: <format>.] The options: <variants>.',
    placeholders: [
      { key: 'setting', required: false },
      { key: 'metric', required: false },
      { key: 'format', required: false },
      { key: 'variants', required: true },
    ],
    notes: 'Examples of metrics: correctness, completeness, comprehensibility, etc.',
    examples: [
      'Discuss the following options considering correctness measures. The options: representing an author as a separate class vs. representing it as an attribute of a book in the setting of a university library considering correctness measures.',
    ],
  },
  {
    id: 'contextualize',
    name: 'Contextualize',
    description: 'Prompts defining the context of the overall interaction',
    purpose: null,
    structure: null,
    placeholders: [],
    notes: null,
    examples: [],
  },
];

/**
 * Array of all template IDs.
 * @type {string[]}
 */
export const TEMPLATE_IDS = TEMPLATES.map((template) => template.id);

/**
 * Retrieves a template by its ID.
 *
 * @param {string} id - The kebab-case identifier of the template.
 * @returns {Object|undefined} The template object, or undefined if not found.
 */
export function getTemplate(id) {
  return TEMPLATES.find((template) => template.id === id);
}

/**
 * Fills a template with values for its placeholders and resolves optional segments.
 *
 * @param {Object} template - The template object to populate.
 * @param {Record<string, any>} [values={}] - Map of placeholder keys to replacement values.
 * @param {Object} [options={}] - Additional configuration options.
 * @returns {string} The fully resolved prompt string.
 * @throws {Error} If template has no structure, or if a required placeholder is missing.
 */
export function fillTemplate(template, values = {}, options = {}) {
  if (!template || template.structure === null || template.structure === undefined) {
    throw new Error(
      `Template "${template?.name || template?.id || 'unknown'}" has no structure.`
    );
  }

  // Validate required placeholders
  const placeholders = template.placeholders || derivePlaceholders(template.structure);
  for (const placeholder of placeholders) {
    if (placeholder.required) {
      const val = values[placeholder.key];
      if (val === undefined || val === null || String(val).trim() === '') {
        throw new Error(
          `Missing required value for placeholder "${placeholder.key}" in template "${template.id}".`
        );
      }
    }
  }

  let result = template.structure;

  // Process optional segments denoted by [square brackets].
  // An optional [segment] is kept (with brackets removed) only if every placeholder
  // inside it has a non-empty value in values. Otherwise, the segment is removed.
  result = result.replace(/\[([^\]]*)\]/g, (_match, segmentContent) => {
    const tokens = [];
    const tokenRegex = /<([^>]+)>/g;
    let tokenMatch;

    while ((tokenMatch = tokenRegex.exec(segmentContent)) !== null) {
      tokens.push(tokenMatch[1]);
    }

    const allFilled =
      tokens.length > 0 &&
      tokens.every((key) => {
        const val = values[key];
        return val !== undefined && val !== null && String(val).trim() !== '';
      });

    if (allFilled) {
      return segmentContent.replace(/<([^>]+)>/g, (_m, key) => {
        return values[key] !== undefined && values[key] !== null ? String(values[key]) : '';
      });
    }

    return '';
  });

  // Replace remaining placeholders (required ones outside optional blocks)
  result = result.replace(/<([^>]+)>/g, (_match, key) => {
    const val = values[key];
    return val !== undefined && val !== null ? String(val) : '';
  });

  // Clean up leftover double spaces and stray spaces before punctuation
  result = result
    .replace(/\s+([.,;:!?])/g, '$1')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();

  return result;
}

export default TEMPLATES;

/*
================================================================================
USAGE EXAMPLES & SANITY CHECKS
================================================================================

// --- Basic Usage Example ---
// import { getTemplate, fillTemplate } from './templates';
//
// const template = getTemplate('create-model');
// const prompt = fillTemplate(template, {
//   model: 'class diagram',
//   format: 'PlantUML',
//   desc: 'A University is interested in an information system that will assist in managing books.'
// });
// console.log(prompt);

// --- Sanity Check 1: Create Model ---
// 1a. With format:
// fillTemplate(getTemplate('create-model'), {
//   model: 'class diagram',
//   format: 'PlantUML',
//   desc: 'A University is interested in an information system that will assist in managing books.'
// });
// Expected Output:
// "Create a class diagram from the following description. Present the response in the following format: PlantUML. The description: A University is interested in an information system that will assist in managing books."
//
// 1b. Without format:
// fillTemplate(getTemplate('create-model'), {
//   model: 'class diagram',
//   desc: 'A University is interested in an information system that will assist in managing books.'
// });
// Expected Output:
// "Create a class diagram from the following description. The description: A University is interested in an information system that will assist in managing books."

// --- Sanity Check 2: Present ---
// fillTemplate(getTemplate('present'), {
//   format: 'XMI'
// });
// Expected Output:
// "Present the previous response in the following format: XMI."

// --- Sanity Check 3: Discuss (with only some optional parts filled) ---
// fillTemplate(getTemplate('discuss'), {
//   setting: 'a university library',
//   variants: 'representing an author as a separate class vs. representing it as an attribute of a book'
// });
// Expected Output:
// "Discuss the following options in the setting of a university library. The options: representing an author as a separate class vs. representing it as an attribute of a book."
*/
