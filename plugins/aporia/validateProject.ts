import { Message } from '../../src/types/requestBody';
import {
  HookEventType,
  PluginContext,
  PluginHandler,
  PluginParameters,
} from '../types';
import { post } from '../utils';

export const APORIA_BASE_URL = 'https://gr-prd.aporia.com';

export const validate = async (
  projectID: string,
  credentials: any,
  data: any,
  timeout?: number
) => {
  const options = {
    headers: {
      'X-APORIA-API-KEY': `${credentials.apiKey}`,
    },
  };
  let baseURL = APORIA_BASE_URL;
  // Allow endpoint configuration to support aporia trial endpoint
  // Aporia trial endpoint: https://gr-prd-trial.aporia.com
  if (credentials.apiEndpoint) {
    baseURL = credentials.apiEndpoint;
  }

  return post(`${baseURL}/${projectID}/validate`, data, options, timeout);
};

export const handler: PluginHandler = async (
  context: PluginContext,
  parameters: PluginParameters,
  eventType: HookEventType
) => {
  let error = null;
  let verdict = false;
  let data = null;

  try {
    const aporiaObject: any = {
      messages: context.request?.json?.messages,
      explain: true,
    };

    aporiaObject['messages'] = aporiaObject['messages']?.map(
      (message: Message) => {
        if (typeof message.content === 'string') {
          return message;
        } else {
          const _content = message.content?.reduce(
            (value, item) =>
              value + (item.type === 'text' ? `${item.text}\n` ?? '' : ''),
            ''
          );
          return { ...message, content: _content };
        }
      }
    );

    if (eventType === 'beforeRequestHook') {
      aporiaObject.validation_target = 'prompt';
    } else {
      aporiaObject.response = context.response?.text;
      aporiaObject.validation_target = 'response';
    }

    // Run the aporia checks
    const result: any = await validate(
      parameters.projectID,
      parameters.credentials,
      aporiaObject,
      parameters.timeout
    );

    // Result example:
    // {
    //   "action": "modify",
    //   "revised_response": "Modified response based on policy",
    //   "explain_log": [
    //     {
    //       "policy_id": "001",
    //       "target": "response",
    //       "result": "issue_detected",
    //       "details": {
    //         ...
    //       }
    //     },
    //     ...
    //   ],
    //   "policy_execution_result": {
    //     "policy_log": [
    //       {
    //         "policy_id": "001",
    //         "policy_type": "content_check",
    //         "target": "response"
    //       }
    //     ],
    //     "action": {
    //       "type": "modify",
    //       "revised_message": "Modified response based on policy"
    //     }
    //   }
    // }

    if (result.action == 'passthrough') {
      verdict = true;
    } else {
      verdict = false;
    }

    data = result;
  } catch (e: any) {
    delete e.stack;
    error = e;
  }

  return { error, verdict, data };
};
