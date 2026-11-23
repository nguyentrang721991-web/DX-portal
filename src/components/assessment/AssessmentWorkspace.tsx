import { useEffect, useState } from 'react';

import type { AssessmentCase } from '../../types/assessment';

import { getAssessmentCase } from '../../utils/assessmentApi';

Sau đó thêm:

type Props = { productId: string; productName: string; };
export default function AssessmentWorkspace({ productId, productName }: Props) {

 const [data, setData] = useState<AssessmentCase | null>(null);

 const [error, setError] = useState('');

 useEffect(() => {

 getAssessmentCase('IR-MVP-001')

 .then((result) => {

 if (result.product_id === productId) setData(result);

 })

 .catch((err) => setError(err.message));

 }, [productId]);
  if (error) return <div>Lỗi: {error}</div>;

 if (!data) return <div>Đang tải hồ sơ đánh giá...</div>;

 return (

 <div>

 <h2>Đánh giá nhân rộng</h2>

 <p>Sản phẩm: {productName}</p>

 <p>Case: {data.case_code}</p>

 <p>Bước hiện tại: {data.current_step}</p>

 <p>Trạng thái: {data.status}</p>

 </div>

 );

}
