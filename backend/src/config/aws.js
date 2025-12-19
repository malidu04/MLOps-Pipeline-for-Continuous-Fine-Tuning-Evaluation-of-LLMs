export default {
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION || 'us-east-1',
  s3: {
    bucket: process.env.AWS_S3_BUCKET || 'ml-platform-models',
    trainingDataPrefix: 'training-data/',
    modelPrefix: 'models/',
    evaluationPrefix: 'evaluations/',
  },
  sagemaker: {
    roleArn: process.env.AWS_SAGEMAKER_ROLE_ARN,
    instanceType: process.env.AWS_SAGEMAKER_INSTANCE_TYPE || 'ml.m5.large',
  },
};