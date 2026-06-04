const awsConfig = {
  Auth: {
    Cognito: {
      userPoolId: process.env.REACT_APP_USER_POOL_ID || 'us-east-1_XXXXXXXXX',
      userPoolClientId: process.env.REACT_APP_USER_POOL_CLIENT_ID || 'XXXXXXXXXXXXXXXXXXXXXXXXXX',
      loginWith: {
        email: true,
      },
      signUpVerificationMethod: 'code',
      userAttributes: {
        email: { required: true },
        name: { required: true },
      },
      passwordFormat: {
        minLength: 8,
        requireLowercase: true,
        requireUppercase: true,
        requireNumbers: true,
        requireSpecialCharacters: false,
      },
    },
  },
  API: {
    REST: {
      MelinaAPI: {
        endpoint: process.env.REACT_APP_API_ENDPOINT || 'http://localhost:4000',
        region: process.env.REACT_APP_AWS_REGION || 'us-east-1',
      },
    },
  },
};

export default awsConfig;
