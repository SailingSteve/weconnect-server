// weconnect-server/controllers/questionnaireControllers.js
const { findQuestionAnswerListByParams, findQuestionListByParams, findQuestionnaireListByIdList } = require('../models/questionnaireModel');
const { arrayContains } = require('../utils/arrayContains');

exports.retrieveQuestionnaireResponseListByPersonIdList = async (personIdList) => {
  // const personAnswersByPersonId = {};
  let questionAnswerList = [];
  let questionList = [];
  const questionnaireIdList = [];
  let questionnaireList = [];
  let status = '';
  let success = true;

  // Start with the questionAnswer data received for personIds in personIdList
  // console.log('personIdList:', personIdList);
  try {
    const params = {
      personId: { in: personIdList },
    };
    questionAnswerList = await findQuestionAnswerListByParams(params);
    success = true;
    // console.log('== AFTER findQuestionAnswerListByParams questionAnswerList:', questionAnswerList);
    if (questionAnswerList) {
      status += 'QUESTION_ANSWER_LIST_FOUND ';
    } else {
      status += 'QUESTION_ANSWER_LIST_NOT_FOUND ';
    }
  } catch (err) {
    // console.log('=== Error retrieving findQuestionAnswerListByParams:', err);
    status += err.message;
    success = false;
  }
  if (success && questionAnswerList.length > 0) {
    const keys = Object.keys(questionAnswerList);
    const values = Object.values(questionAnswerList);
    for (let i = 0; i < keys.length; i++) {
      // const onePersonId = values[i].personId;
      const oneQuestionnaireId = values[i].questionnaireId;
      if (!arrayContains(oneQuestionnaireId, questionnaireIdList)) {
        questionnaireIdList.push(oneQuestionnaireId);
      }
      // if (!(onePersonId in personAnswersByPersonId)) {
      //   personAnswersByPersonId[onePersonId] = [];
      // }
    }
    // console.log('== AFTER findQuestionAnswerListByParams questionnaireIdList:', questionnaireIdList);
  }

  // Get the list of questions so we know what the person is answering
  if (success && questionnaireIdList.length > 0) {
    try {
      const params = {
        questionnaireId: { in: questionnaireIdList },
      };
      questionList = await findQuestionListByParams(params);
      success = true;
      // console.log('== AFTER findQuestionListByParams questionList:', questionList);
      if (questionList) {
        status += 'QUESTION_LIST_FOUND ';
      } else {
        status += 'QUESTION_LIST_NOT_FOUND ';
      }
    } catch (err) {
      // console.log('=== Error retrieving findQuestionListByParams:', err);
      status += err.message;
      success = false;
    }
  }

  // Retrieve the questionnaires so we can organize the answers by questionnaire
  if (success && questionnaireIdList.length > 0) {
    // Get the list of questions so we know what the person is answering
    try {
      questionnaireList = await findQuestionnaireListByIdList(questionnaireIdList);
      success = true;
      // console.log('== AFTER findQuestionnaireListByIdList questionnaireList:', questionnaireList);
      if (questionnaireList) {
        status += 'QUESTIONNAIRE_LIST_FOUND ';
      } else {
        status += 'QUESTIONNAIRE_LIST_NOT_FOUND ';
      }
    } catch (err) {
      // console.log('=== Error retrieving findQuestionnaireListByIdList:', err);
      status += err.message;
      success = false;
    }
  }
  return {
    questionAnswerList,
    questionList,
    questionnaireList,
    success,
    status,
  };
};
