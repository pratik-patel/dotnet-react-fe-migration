import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { MvcLayout } from "../../components/shared/MvcLayout";
import { type PostsMode, usePostsRoute } from "../../hooks/usePostsRoute";

interface PostRow {
  postId: number;
  blogId: number;
  bloggerName: string;
  title: string;
  content: string;
  tagNames: string;
  lastUpdatedUtc: string;
}

interface PostFormModel {
  postId: number;
  title: string;
  content: string;
  bloggers: string;
  userChosenTags: string[];
}

type FieldErrorMap = Record<string, string[]>;

const bloggers = ["Alice", "Bob", "Carol"];
const tags = ["Architecture", "EF", "DDD", "Validation", "Async"];

const initialPosts: PostRow[] = [
  {
    postId: 1,
    blogId: 1,
    bloggerName: "Alice",
    title: "GenericServices intro",
    content: "This post introduces GenericServices patterns for MVC.",
    tagNames: "Architecture, EF",
    lastUpdatedUtc: "2025-01-10"
  },
  {
    postId: 2,
    blogId: 2,
    bloggerName: "Bob",
    title: "Validation pipeline",
    content: "Validation strategy across browser, MVC and EF.",
    tagNames: "Validation, DDD",
    lastUpdatedUtc: "2025-01-12"
  }
];

function toShortDateString(value: string) {
  return new Date(value).toLocaleDateString("en-US");
}

function parseIdFromPath(pathname: string): number | null {
  const parts = pathname.split("/").filter(Boolean);
  const idRaw = parts[2];
  if (!idRaw) return null;
  const id = Number(idRaw);
  return Number.isFinite(id) ? id : null;
}

function createInitialForm(post?: PostRow): PostFormModel {
  if (!post) {
    return {
      postId: 0,
      title: "",
      content: "",
      bloggers: "",
      userChosenTags: []
    };
  }

  return {
    postId: post.postId,
    title: post.title,
    content: post.content,
    bloggers: post.bloggerName,
    userChosenTags: post.tagNames.split(",").map((item) => item.trim()).filter(Boolean)
  };
}

function validatePostForm(model: PostFormModel): FieldErrorMap {
  const errors: FieldErrorMap = {};

  const addError = (field: string, message: string) => {
    errors[field] = errors[field] || [];
    errors[field].push(message);
  };

  if (model.title.trim().length < 2 || model.title.trim().length > 128) {
    addError("Title", "Title must have between 2 and 128 characters in it.");
  }

  if (model.title.includes("<") || model.title.includes(">")) {
    addError("Title", "Title must not contain HTML symbols like < or >.");
  }

  if (model.title.includes("!")) {
    addError("Title", "Title must not include an exclamation mark (!).");
  }

  if (model.title.trim().endsWith("?")) {
    addError("Title", "Title must not end with a question mark (?).");
  }

  if (!model.content.trim()) {
    addError("Content", "Content cannot be empty.");
  }

  if (model.content.includes("<") || model.content.includes(">")) {
    addError("Content", "Content must not contain HTML symbols like < or >.");
  }

  const lowerContent = model.content.toLowerCase();
  const blockedEndings = [" sheep.", " lamb.", " cow.", " calf."];
  if (blockedEndings.some((ending) => lowerContent.includes(ending))) {
    addError("Content", "Content must not contain sentences ending with sheep/lamb/cow/calf.");
  }

  if (!model.bloggers) {
    addError("Bloggers", "A blogger must be assigned to the post.");
  }

  if (model.userChosenTags.length === 0) {
    addError("UserChosenTags", "At least one tag must be assigned to the post.");
  }

  return errors;
}

function flattenErrors(errorMap: FieldErrorMap) {
  return Object.values(errorMap).flat();
}

function resolveFormMode(mode: PostsMode): "create" | "edit" | null {
  if (mode === "create") return "create";
  if (mode === "edit") return "edit";
  return null;
}

export function PostsScreen() {
  const { mode, pathname } = usePostsRoute();
  const navigate = useNavigate();

  const [posts, setPosts] = useState<PostRow[]>(initialPosts);
  const [message, setMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isDelayLoading, setIsDelayLoading] = useState(false);

  const routeId = parseIdFromPath(pathname);

  useEffect(() => {
    if (mode === "delete") {
      if (!routeId) {
        setErrorMessage("Delete failed: no post id provided.");
      } else {
        setPosts((prev) => {
          const exists = prev.some((item) => item.postId === routeId);
          if (!exists) {
            setErrorMessage("Delete failed: post not found.");
            return prev;
          }
          setMessage("Successfully deleted post");
          return prev.filter((item) => item.postId !== routeId);
        });
      }
      navigate("/Posts/Index", { replace: true });
    }
  }, [mode, routeId, navigate]);

  useEffect(() => {
    if (mode === "reset") {
      setPosts(initialPosts);
      setMessage("Successfully reset the blogs data");
      setErrorMessage(null);
      navigate("/Posts/Index", { replace: true });
    }
  }, [mode, navigate]);

  const currentRow = useMemo(() => {
    if (!routeId) return null;
    return posts.find((item) => item.postId === routeId) || null;
  }, [posts, routeId]);

  return (
    <MvcLayout>
      {mode === "index" ? (
        <PostsIndex
          posts={posts}
          message={message}
          errorMessage={errorMessage}
          onClearMessages={() => {
            setMessage(null);
            setErrorMessage(null);
          }}
        />
      ) : null}

      {resolveFormMode(mode) ? (
        <PostsForm
          mode={resolveFormMode(mode)!}
          currentRow={currentRow}
          onSave={(payload) => {
            if (payload.postId > 0) {
              setPosts((prev) => prev.map((item) => {
                if (item.postId !== payload.postId) return item;
                return {
                  ...item,
                  title: payload.title,
                  content: payload.content,
                  bloggerName: payload.bloggers,
                  tagNames: payload.userChosenTags.join(", "),
                  lastUpdatedUtc: new Date().toISOString().slice(0, 10)
                };
              }));
              setMessage("Successfully updated post");
            } else {
              const nextId = Math.max(0, ...posts.map((item) => item.postId)) + 1;
              setPosts((prev) => [
                ...prev,
                {
                  postId: nextId,
                  blogId: nextId,
                  bloggerName: payload.bloggers,
                  title: payload.title,
                  content: payload.content,
                  tagNames: payload.userChosenTags.join(", "),
                  lastUpdatedUtc: new Date().toISOString().slice(0, 10)
                }
              ]);
              setMessage("Successfully created post");
            }
            setErrorMessage(null);
            navigate("/Posts/Index");
          }}
          onMissingRow={() => {
            setErrorMessage("Post not found.");
            navigate("/Posts/Index");
          }}
        />
      ) : null}

      {mode === "details" ? <PostsDetails row={currentRow} /> : null}

      {mode === "delay" ? (
        <PostsDelay
          isLoading={isDelayLoading}
          onLoadStart={() => setIsDelayLoading(true)}
          onLoadEnd={() => setIsDelayLoading(false)}
        />
      ) : null}

      {mode === "codeview" ? <PostsCodeView /> : null}
      {mode === "numposts" ? <PostsNumPosts count={posts.length} /> : null}
    </MvcLayout>
  );
}

interface PostsIndexProps {
  posts: PostRow[];
  message: string | null;
  errorMessage: string | null;
  onClearMessages: () => void;
}

function PostsIndex({ posts, message, errorMessage, onClearMessages }: PostsIndexProps) {
  return (
    <>
      <h2>Posts</h2>

      {message ? <div className="text-success">{message}</div> : null}
      {message ? <br /> : null}
      {errorMessage ? <div className="text-danger"><strong>{errorMessage}</strong></div> : null}
      {(message || errorMessage) ? (
        <p>
          <button type="button" className="btn btn-default btn-xs" onClick={onClearMessages}>Dismiss message</button>
        </p>
      ) : null}

      <p>
        This is a demonstration of <a href="https://github.com/JonPSmith/GenericServices" target="_blank" rel="noreferrer">GenericServices&apos;</a>
        database CRUD (Create, Read, Update/Edit and Delete) services done synchronously, i.e no wait states to improve web site capacity.
        (See <Link to="/PostsAsync/Index">Posts Async</Link> for async versions of the same commands).
      </p>
      <p>
        Below you will see a table of posts which can be manipulated. We have chosen a POST as an example as it has the following attributes:
      </p>
      <ul>
        <li>When we list them we want &apos;shape&apos; what the user sees, i.e. we leave out the post content but include the blogger Name and Tags.</li>
        <li>The create and edit commands are non-trivial because Posts links to other tables, like author and the tags.</li>
      </ul>
      <hr />

      <div data-testid="posts-top-links">
        <span>
          <Link to="/Posts/Create">Create New Post</Link> | <Link to="/Tags/Index">Tags Page</Link> | <Link to="/Blogs/Index">Blogs Page</Link> | <Link to="/Posts/Reset">Reset Blogs data</Link>
        </span>
        <span className="pull-right"><strong><Link to="/Posts/CodeView">Explanation of the code</Link></strong></span>
      </div>

      <table className="table" data-testid="posts-grid">
        <thead>
          <tr>
            <th>BloggerName</th>
            <th>Title</th>
            <th>Last updated</th>
            <th>TagNames</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {posts.map((item) => (
            <tr key={item.postId}>
              <td>{item.bloggerName}</td>
              <td>{item.title}</td>
              <td>{toShortDateString(item.lastUpdatedUtc)}</td>
              <td>{item.tagNames}</td>
              <td>
                <Link to={`/Posts/Edit/${item.postId}`}>Edit</Link> | <Link to={`/Posts/Details/${item.postId}`}>Details</Link> | <Link to={`/Posts/Delete/${item.postId}`}>Delete</Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <span>
        <Link to="/Posts/Delay">Delay for 500ms (Sync)</Link>
        &nbsp;Useful for checking capacity of web server
      </span>
    </>
  );
}

interface PostsFormProps {
  mode: "create" | "edit";
  currentRow: PostRow | null;
  onSave: (payload: PostFormModel) => void;
  onMissingRow: () => void;
}

function PostsForm({ mode, currentRow, onSave, onMissingRow }: PostsFormProps) {
  useEffect(() => {
    if (mode === "edit" && !currentRow) onMissingRow();
  }, [mode, currentRow, onMissingRow]);

  const [model, setModel] = useState<PostFormModel>(() => createInitialForm(mode === "edit" ? currentRow ?? undefined : undefined));
  const [errors, setErrors] = useState<FieldErrorMap>({});

  useEffect(() => {
    setModel(createInitialForm(mode === "edit" ? currentRow ?? undefined : undefined));
    setErrors({});
  }, [mode, currentRow]);

  const title = mode === "create" ? "Create" : "Edit";
  const submitLabel = mode === "create" ? "Create" : "Save";

  const allErrors = flattenErrors(errors);

  return (
    <>
      <h2>{title}</h2>

      <form
        data-testid="posts-form"
        onSubmit={(event) => {
          event.preventDefault();
          const nextErrors = validatePostForm(model);
          setErrors(nextErrors);
          if (flattenErrors(nextErrors).length > 0) return;
          onSave(model);
        }}
      >
        <div className="form-horizontal">
          <h4>{mode === "create" ? "Post" : "DetailPostDto"}</h4>
          <hr />

          {allErrors.length > 0 ? (
            <div className="text-danger validation-summary">
              <ul>
                {allErrors.map((item) => <li key={item}>{item}</li>)}
              </ul>
            </div>
          ) : null}

          {mode === "edit" ? <input type="hidden" value={model.postId} name="PostId" /> : null}

          <div className="form-group">
            <label className="control-label col-md-2" htmlFor="post-title">Title</label>
            <div className="col-md-10">
              <input
                id="post-title"
                className="form-control"
                value={model.title}
                onChange={(event) => setModel((prev) => ({ ...prev, title: event.target.value }))}
              />
              {(errors.Title || []).map((item) => <div key={item} className="text-danger">{item}</div>)}
            </div>
          </div>

          <div className="form-group">
            <label className="control-label col-md-2" htmlFor="post-content">Content</label>
            <div className="col-md-10">
              <textarea
                id="post-content"
                className="form-control"
                value={model.content}
                onChange={(event) => setModel((prev) => ({ ...prev, content: event.target.value }))}
              />
              {(errors.Content || []).map((item) => <div key={item} className="text-danger">{item}</div>)}
            </div>
          </div>

          <div className="form-group">
            <label className="control-label col-md-2" htmlFor="post-blogger">Bloggers</label>
            <div className="col-md-10">
              <select
                id="post-blogger"
                className="form-control"
                value={model.bloggers}
                onChange={(event) => setModel((prev) => ({ ...prev, bloggers: event.target.value }))}
              >
                <option value="">-- Select blogger --</option>
                {bloggers.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
              {(errors.Bloggers || []).map((item) => <div key={item} className="text-danger">{item}</div>)}
            </div>
          </div>

          <div className="form-group">
            <label className="control-label col-md-2" htmlFor="post-tags">Tags</label>
            <div className="col-md-10">
              <select
                id="post-tags"
                className="form-control"
                multiple
                value={model.userChosenTags}
                onChange={(event) => {
                  const selected = Array.from(event.target.selectedOptions).map((option) => option.value);
                  setModel((prev) => ({ ...prev, userChosenTags: selected }));
                }}
              >
                {tags.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
              {(errors.UserChosenTags || []).map((item) => <div key={item} className="text-danger">{item}</div>)}
            </div>
          </div>

          <div className="form-group">
            <div className="col-md-offset-2 col-md-10">
              <input type="submit" value={submitLabel} className="btn btn-default" />
            </div>
          </div>
        </div>
      </form>

      <div>
        <Link to="/Posts/Index">Back to List</Link>
      </div>
      <hr />
      <PostValidationReference />
    </>
  );
}

interface PostsDetailsProps {
  row: PostRow | null;
}

function PostsDetails({ row }: PostsDetailsProps) {
  if (!row) {
    return (
      <>
        <h2>Details</h2>
        <div className="text-danger">Post not found.</div>
        <p><Link to="/Posts/Index">Back to List</Link></p>
      </>
    );
  }

  return (
    <>
      <h2>Details</h2>
      <div>
        <h4>DetailPostDto</h4>
        <hr />
        <dl className="dl-horizontal">
          <dt>Title</dt>
          <dd>{row.title}</dd>

          <dt>Content</dt>
          <dd>{row.content}</dd>

          <dt>BloggerName</dt>
          <dd>{row.bloggerName}</dd>

          <dt>Last updated</dt>
          <dd>{toShortDateString(row.lastUpdatedUtc)}</dd>

          <dt>TagNames</dt>
          <dd>{row.tagNames}</dd>
        </dl>
      </div>
      <p>
        <Link to={`/Posts/Edit/${row.postId}`}>Edit</Link> | <Link to="/Posts/Index">Back to List</Link>
      </p>
    </>
  );
}

interface PostsDelayProps {
  isLoading: boolean;
  onLoadStart: () => void;
  onLoadEnd: () => void;
}

function PostsDelay({ isLoading, onLoadStart, onLoadEnd }: PostsDelayProps) {
  const [value, setValue] = useState<number | null>(null);

  useEffect(() => {
    onLoadStart();
    const timer = setTimeout(() => {
      setValue(500);
      onLoadEnd();
    }, 500);

    return () => clearTimeout(timer);
  }, [onLoadStart, onLoadEnd]);

  return (
    <>
      <h2>Posts Delay</h2>
      <br />
      <p>{isLoading ? "Loading delay..." : `I delayed by ${value ?? 0} ms.`}</p>
      <div><Link to="/Posts/Index">Back to List</Link></div>
    </>
  );
}

function PostsNumPosts({ count }: { count: number }) {
  return (
    <>
      <h2>Test</h2>
      <div>
        <h4>Test </h4>
        <hr />
        <p>The total number of Posts is {count}</p>
      </div>
      <p><Link to="/Posts/Index">Back to List</Link></p>
    </>
  );
}

function PostsCodeView() {
  return (
    <>
      <h2>Posts: An explanation of Post code</h2>
      <p>
        <strong>
          This is a summary of the main parts used to list, detail, create, edit and delete Post entries via a DTO.
          This type of services that needs a DTO are used when the data class has dependent foreign keys that
          need to be manipulated before the data class can be written to the database.
        </strong>
      </p>
      <p>
        The headers contain links to the code on GitHub for you to look at.
        For most of you the links to the code will be sufficient, but more information is available by clicking on the panel titles.
      </p>
      <h3>The Posts Controller</h3>
      <p>
        The <code>PostsController</code> uses GenericServices DTO-based database commands and includes list/detail/create/update/delete actions.
      </p>
      <h3>The GenericService methods</h3>
      <p>
        ListService, DetailService, UpdateService, CreateService and DeleteService are demonstrated in this sample.
      </p>
      <h3>The DetailPostDto DTO</h3>
      <p>
        The DetailPostDto DTO drives Create/Edit with blogger and tag selection via editor templates.
      </p>
    </>
  );
}

function PostValidationReference() {
  return (
    <div className="small">
      <h4>Post Validation rules</h4>
      <p>
        To help with testing the Post data class has extra rules over the DetailPostDto.
        This means that more tests are done when the database is updated, which are then caught by SaveChanges and sent back as errors.
      </p>

      <h5>Rules in both DetailPostDto and Post</h5>
      <table className="table">
        <thead>
          <tr>
            <th>Property</th>
            <th>Validation rule</th>
            <th>Where shown?</th>
            <th>Where Checked*</th>
          </tr>
        </thead>
        <tbody>
          <tr><td>Title</td><td>Must have between 2 and 128 characters in it</td><td>By property</td><td>Browser,MVC,EF</td></tr>
          <tr><td>Title</td><td>Must not contain HTML symbols, e.g. &lt;, &gt;</td><td>Exception</td><td>MVC</td></tr>
          <tr><td>Content</td><td>Cannot be empty</td><td>By property</td><td>Browser,MVC,EF</td></tr>
          <tr><td>Content</td><td>Must not contain HTML symbols, e.g. &lt;, &gt;</td><td>Exception</td><td>MVC</td></tr>
          <tr><td>Blog (Author)</td><td>Must have a blogger assigned to the post</td><td>By property</td><td>DTO,EF</td></tr>
          <tr><td>Tags</td><td>Must have at least one tag assigned to the Post</td><td>By property</td><td>DTO,EF</td></tr>
        </tbody>
      </table>
    </div>
  );
}
