import { Link } from 'react-router-dom';
import { Empty } from '../components/Common';

export default function NotFound() {
  return (
    <div className="container page">
      <Empty title="Page not found" text="The page you're looking for doesn't exist or has moved." action={<Link className="btn btn-primary" to="/">Back to home</Link>} />
    </div>
  );
}
