use candle_core::Tensor;
use std::error::Error;

#[tokio::test]
async fn test_basic_tensor_ops() -> Result<(), Box<dyn Error>> {
    // Create a test tensor with 4 elements
    let tensor = Tensor::new(&[1.0f32, 2.0, 3.0, 4.0], &candle_core::Device::Cpu)?;
    assert_eq!(tensor.dims(), &[4]);

    // Test values directly
    let values = tensor.to_vec1::<f32>()?;
    assert_eq!(values, vec![1.0, 2.0, 3.0, 4.0]);

    // Test shape transformations
    let reshaped = tensor.reshape((2, 2))?;
    assert_eq!(reshaped.dims(), &[2, 2]);

    // Test basic operations one at a time
    let first = tensor.get(0)?;
    assert_eq!(first.to_scalar::<f32>()?, 1.0);

    Ok(())
}

#[tokio::test]
async fn test_basic_tensor_ops2() -> Result<(), Box<dyn Error>> {
    // Create a test tensor with 4 elements
    let tensor = Tensor::new(&[1.0f32, 2.0, 3.0, 4.0], &candle_core::Device::Cpu)?;
    assert_eq!(tensor.dims(), &[4]);

    // Test basic operations - sum
    let sum = tensor.sum(0)?;
    let sum_val = sum.to_scalar::<f32>()?;
    assert_eq!(sum_val, 10.0);

    // Test shape transformations
    let reshaped = tensor.reshape((2, 2))?;
    assert_eq!(reshaped.dims(), &[2, 2]);

    // Test element-wise operations
    let doubled = (&tensor * 2.0)?; // Using scalar multiplication operator
    let expected = Tensor::new(&[2.0f32, 4.0, 6.0, 8.0], &candle_core::Device::Cpu)?;
    let doubled_vec = doubled.to_vec1::<f32>()?;
    let expected_vec = expected.to_vec1::<f32>()?;
    assert_eq!(doubled_vec, expected_vec);

    Ok(())
}
